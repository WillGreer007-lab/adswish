-- Adswish Phase 2: Aggregate rating triggers, review constraints, notification helpers

-- ============================================
-- Aggregate Rating: Deferred trigger function
-- ============================================

CREATE OR REPLACE FUNCTION recalculate_average_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_user uuid;
  current_avg numeric(3,2);
  new_avg numeric(3,2);
BEGIN
  IF TG_OP = 'INSERT' THEN
    target_user := NEW.reviewee_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.reviewee_id != OLD.reviewee_id THEN
      PERFORM recalc_rating_for_user(OLD.reviewee_id);
    END IF;
    target_user := NEW.reviewee_id;
  ELSIF TG_OP = 'DELETE' THEN
    target_user := OLD.reviewee_id;
  END IF;

  IF target_user IS NOT NULL THEN
    PERFORM recalc_rating_for_user(target_user);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE OR REPLACE FUNCTION recalc_rating_for_user(p_user_id uuid)
RETURNS void AS $$
DECLARE
  new_avg numeric(3,2);
  is_creator boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM creator_profiles WHERE user_id = p_user_id
  ) INTO is_creator;

  SELECT COALESCE(AVG(rating_out_of_5), 0)::numeric(3,2)
  INTO new_avg
  FROM reviews
  WHERE reviewee_id = p_user_id;

  IF is_creator THEN
    UPDATE creator_profiles SET average_rating = new_avg WHERE user_id = p_user_id;
  ELSE
    UPDATE business_profiles SET average_rating = new_avg WHERE user_id = p_user_id;
  END IF;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER review_rating_change
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION recalculate_average_rating();

-- ============================================
-- Notification helper: auto-insert on review
-- ============================================

CREATE OR REPLACE FUNCTION notify_reviewee()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, body, link)
  VALUES (
    NEW.reviewee_id,
    'review',
    'You received a new ' || NEW.rating_out_of_5 || '-star review.',
    '/dashboard'
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER notify_on_review
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION notify_reviewee();

-- ============================================
-- Auto-create notification_preferences on signup
-- ============================================

CREATE OR REPLACE FUNCTION auto_create_notification_prefs()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER auto_notification_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auto_create_notification_prefs();

-- ============================================
-- Review right-to-reply: lock after 30 days
-- ============================================

CREATE OR REPLACE FUNCTION check_review_reply_window()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.created_at < now() - interval '30 days' THEN
    RAISE EXCEPTION 'Review is locked. Right to reply expires after 30 days.';
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER enforce_reply_window
  BEFORE UPDATE OF creator_response ON reviews
  FOR EACH ROW EXECUTE FUNCTION check_review_reply_window();
