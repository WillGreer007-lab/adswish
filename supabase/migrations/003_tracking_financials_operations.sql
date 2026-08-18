-- Adswish Tracking, Conversions, Financials & Operations Schema

-- ============================================
-- Tracking & Conversions
-- ============================================

CREATE TABLE IF NOT EXISTS clicks_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tracking_link_id uuid NOT NULL REFERENCES tracking_links(id) ON DELETE CASCADE,
  ip_hash text NOT NULL,
  user_agent text,
  jwt_fingerprint text,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, clicked_at)
) PARTITION BY RANGE (clicked_at);

CREATE TABLE IF NOT EXISTS clicks_log_2026_08 PARTITION OF clicks_log
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS clicks_log_2026_09 PARTITION OF clicks_log
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS clicks_log_2026_10 PARTITION OF clicks_log
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE IF NOT EXISTS conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_link_id uuid NOT NULL REFERENCES tracking_links(id) ON DELETE CASCADE,
  order_id text NOT NULL,
  order_amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  creator_cut numeric(10,2) NOT NULL,
  platform_cut numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending_hold' CHECK (status IN ('pending_hold', 'released', 'disputed', 'refunded', 'chargeback')),
  hold_expires_at timestamptz,
  disputed_at timestamptz,
  attribution_method text NOT NULL DEFAULT 'cookie' CHECK (attribution_method IN ('cookie', 's2s', 'utm_fallback', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_conversions
  BEFORE UPDATE ON conversions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS daily_conversion_rollups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  date date NOT NULL,
  total_clicks integer NOT NULL DEFAULT 0,
  total_conversions integer NOT NULL DEFAULT 0,
  gross_sales numeric(10,2) NOT NULL DEFAULT 0,
  creator_cut numeric(10,2) NOT NULL DEFAULT 0,
  platform_cut numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, creator_id, date),
  PRIMARY KEY (id, date)
) PARTITION BY RANGE (date);

CREATE TABLE IF NOT EXISTS daily_conversion_rollups_2026_08 PARTITION OF daily_conversion_rollups
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS daily_conversion_rollups_2026_09 PARTITION OF daily_conversion_rollups
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS daily_conversion_rollups_2026_10 PARTITION OF daily_conversion_rollups
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TRIGGER set_updated_at_daily_rollups
  BEFORE UPDATE ON daily_conversion_rollups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS consent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  consent_type text NOT NULL CHECK (consent_type IN ('cookie', 'marketing', 'analytics')),
  consent_version text NOT NULL DEFAULT '1.0',
  granted_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  user_agent text
);

CREATE TABLE IF NOT EXISTS revoked_jtis (
  jti text PRIMARY KEY,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

-- ============================================
-- Financials
-- ============================================

CREATE TABLE IF NOT EXISTS ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  related_conversion_id uuid REFERENCES conversions(id) ON DELETE SET NULL,
  related_deliverable_id uuid REFERENCES deliverables(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('hold', 'release', 'refund', 'chargeback_clawback', 'platform_fee', 'stripe_fee', 'subscription_revenue')),
  amount numeric(10,2) NOT NULL,
  stripe_transfer_id text,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payout_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  month_start date NOT NULL,
  month_end date NOT NULL,
  total_released numeric(10,2) NOT NULL DEFAULT 0,
  pdf_url text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- Reviews & Messaging
-- ============================================

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  rating_out_of_5 integer NOT NULL CHECK (rating_out_of_5 >= 1 AND rating_out_of_5 <= 5),
  written_feedback text,
  creator_response text,
  reported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_reviews
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  encrypted_body bytea,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message_reads (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- ============================================
-- Operations
-- ============================================

CREATE TABLE IF NOT EXISTS sla_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  related_deliverable_id uuid REFERENCES deliverables(id) ON DELETE SET NULL,
  related_conversion_id uuid REFERENCES conversions(id) ON DELETE SET NULL,
  raised_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
  evidence_urls text[] DEFAULT '{}',
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution text CHECK (resolution IN ('force_release', 'refund_business', 'split', 'dismissed')),
  admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_sla_disputes
  BEFORE UPDATE ON sla_disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id text PRIMARY KEY,
  provider text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('payment', 'application', 'sla', 'pixel_offline', 'review', 'message', 'system')),
  body text NOT NULL,
  link text,
  read boolean NOT NULL DEFAULT false,
  email_sent boolean NOT NULL DEFAULT false,
  push_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_types text[] DEFAULT '{}',
  email_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_notification_prefs
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('force_release', 'refund', 'ban_user', 'unban_user', 'resolve_dispute', 'manual_strike', 'override_rating')),
  target_entity_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS failed_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  error_message text,
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE clicks_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_conversion_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE revoked_jtis ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own conversions"
  ON conversions FOR SELECT
  USING (
    tracking_link_id IN (
      SELECT id FROM tracking_links WHERE creator_id = auth.uid()
      UNION
      SELECT id FROM tracking_links WHERE campaign_id IN (SELECT id FROM campaigns WHERE business_id = auth.uid())
    )
  );

CREATE POLICY "Users can read own rollups"
  ON daily_conversion_rollups FOR SELECT
  USING (
    creator_id = auth.uid()
    OR campaign_id IN (SELECT id FROM campaigns WHERE business_id = auth.uid())
  );

CREATE POLICY "Users can read own reviews"
  ON reviews FOR SELECT
  USING (reviewer_id = auth.uid() OR reviewee_id = auth.uid());

CREATE POLICY "Users can create reviews"
  ON reviews FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "Users can respond to own reviews"
  ON reviews FOR UPDATE
  USING (reviewee_id = auth.uid());

CREATE POLICY "Campaign participants can read messages"
  ON messages FOR SELECT
  USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE business_id = auth.uid()
      UNION
      SELECT campaign_id FROM applications WHERE creator_id = auth.uid() AND status = 'accepted'
    )
  );

CREATE POLICY "Campaign participants can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    campaign_id IN (
      SELECT id FROM campaigns WHERE business_id = auth.uid()
      UNION
      SELECT campaign_id FROM applications WHERE creator_id = auth.uid() AND status = 'accepted'
    )
  );

CREATE POLICY "Users can mark own messages read"
  ON message_reads FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can raise disputes"
  ON sla_disputes FOR INSERT
  WITH CHECK (raised_by = auth.uid());

CREATE POLICY "Users can read own disputes"
  ON sla_disputes FOR SELECT
  USING (
    raised_by = auth.uid()
    OR related_deliverable_id IN (
      SELECT id FROM deliverables WHERE creator_id = auth.uid()
      UNION
      SELECT id FROM deliverables WHERE campaign_id IN (SELECT id FROM campaigns WHERE business_id = auth.uid())
    )
  );

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own notification prefs"
  ON notification_preferences FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can read own payout invoices"
  ON payout_invoices FOR SELECT
  USING (creator_id = auth.uid());

CREATE POLICY "Users can read own ledger entries"
  ON ledger_entries FOR SELECT
  USING (
    related_conversion_id IN (
      SELECT id FROM conversions WHERE tracking_link_id IN (
        SELECT id FROM tracking_links WHERE creator_id = auth.uid()
        UNION
        SELECT id FROM tracking_links WHERE campaign_id IN (SELECT id FROM campaigns WHERE business_id = auth.uid())
      )
    )
  );

-- Consent logs: anyone can create (anonymous users granting consent)
CREATE POLICY "Anyone can log consent"
  ON consent_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can read own consent logs"
  ON consent_logs FOR SELECT
  USING (user_id = auth.uid());

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX idx_clicks_log_link_date ON clicks_log(tracking_link_id, clicked_at);
CREATE INDEX idx_conversions_link_date ON conversions(tracking_link_id, created_at);
CREATE INDEX idx_conversions_order_id ON conversions(order_id);
CREATE INDEX idx_conversions_status ON conversions(status);
CREATE INDEX idx_conversions_hold_expires ON conversions(hold_expires_at) WHERE status = 'pending_hold';
CREATE INDEX idx_daily_rollups_campaign_date ON daily_conversion_rollups(campaign_id, date);
CREATE INDEX idx_revoked_jtis_jti ON revoked_jtis(jti, revoked_at);
CREATE INDEX idx_messages_campaign_date ON messages(campaign_id, created_at);
CREATE INDEX idx_message_reads ON message_reads(message_id, user_id);
CREATE INDEX idx_reviews_reviewee_date ON reviews(reviewee_id, created_at);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read, created_at);
CREATE INDEX idx_sla_disputes_status ON sla_disputes(status, opened_at);
CREATE INDEX idx_ledger_entries_conversion ON ledger_entries(related_conversion_id);
CREATE INDEX idx_payout_invoices_creator ON payout_invoices(creator_id, month_start);
CREATE INDEX idx_admin_audit_logs_admin ON admin_audit_logs(admin_id, action_type, created_at);
CREATE INDEX idx_failed_jobs_type ON failed_jobs(job_type, last_attempted_at);

-- ============================================
-- pg_cron jobs
-- ============================================

SELECT cron.schedule(
  'reset-campaign-counters-monthly',
  '0 0 1 * *',
  $$
    UPDATE business_profiles
    SET campaigns_created_this_month = 0,
        campaigns_created_month = to_char(now(), 'YYYY-MM')
    WHERE campaigns_created_month != to_char(now(), 'YYYY-MM')
  $$
);

SELECT cron.schedule(
  'monthly-follower-recheck',
  '0 0 1 * *',
  $$ SELECT 1; $$
);

SELECT cron.schedule(
  'daily-rollup-aggregation',
  '0 0 * * *',
  $$ SELECT 1; $$
);

SELECT cron.schedule(
  'pixel-penalty-check',
  '0 */12 * * *',
  $$ SELECT 1; $$
);

SELECT cron.schedule(
  'create-clicks-partition-monthly',
  '0 0 25 * *',
  $$ SELECT 1; $$
);
