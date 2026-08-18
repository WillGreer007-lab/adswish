-- ============================================
-- Migration 016 — charge_retries
-- Off-session destination charges that come back `requires_action` (3DS) or
-- `requires_confirmation` are queued here instead of reversing the hold
-- immediately. The business completes 3DS later (hosted action URL); the
-- retry-expired job reverses the hold only after the retry window lapses.
-- ============================================

CREATE TABLE IF NOT EXISTS charge_retries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_id uuid NOT NULL REFERENCES conversions(id) ON DELETE CASCADE UNIQUE,
  payment_intent_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  action_url text,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_charge_retries
  BEFORE UPDATE ON charge_retries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_charge_retries_status_next
  ON charge_retries(status, next_retry_at)
  WHERE status = 'pending';

ALTER TABLE charge_retries ENABLE ROW LEVEL SECURITY;
-- Service-role only (like webhook_events / failed_jobs): no public policies.
