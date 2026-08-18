-- 010: Fix auto_notification_prefs trigger breaking new user creation.
--
-- The trigger on auth.users (migration 004) used a SECURITY DEFINER function
-- without a pinned search_path, so during auth inserts it could not resolve
-- public.notification_preferences → "Database error creating new user".
--
-- Fix: fully-qualify the target table and pin search_path = public.

DROP TRIGGER IF EXISTS auto_notification_prefs ON auth.users;

CREATE OR REPLACE FUNCTION public.auto_create_notification_prefs()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER
   SET search_path = public;

CREATE TRIGGER auto_notification_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_notification_prefs();
