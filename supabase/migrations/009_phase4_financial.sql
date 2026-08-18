-- 009: Phase 4 — Financial Routing (Stripe)
-- Adds the columns needed to link Stripe objects back to app rows and to
-- gate payouts on tax forms. All columns are additive and nullable-safe.

-- Creator: link Stripe Connect account + billing customer, tax-form gating.
ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS tax_form_status text NOT NULL DEFAULT 'not_submitted'
    CHECK (tax_form_status IN ('not_submitted', 'submitted', 'approved'));

-- Business: link Stripe billing customer (payment method / subscriptions).
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Conversions: link the Stripe destination charge + transfer so refunds and
-- chargebacks can be mapped back to the right conversion.
ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS payout_invoice_id uuid REFERENCES payout_invoices(id) ON DELETE SET NULL;

-- Webhook events: track delivery attempts for the retry / DLQ policy.
ALTER TABLE webhook_events
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;

-- ============================================
-- Phase 4 pg_cron schedules (financial routing)
-- NOTE: like migration 005, these target http://localhost:3000 — swap for the
-- deployed URL before production. Each job is targeted via the request body.
-- ============================================

-- Hourly: release conversions whose 7-day hold has expired.
SELECT cron.schedule(
  'release-expired-holds',
  '45 * * * *',
  $$
    SELECT net.http_post(
      url := 'http://localhost:3000/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer adswish-cron'
      ),
      body := '{"jobs":["release-holds"]}'::jsonb
    );
  $$
);

-- Weekly (Sunday 01:00): creator payouts at/over the $25 minimum.
SELECT cron.schedule(
  'weekly-creator-payouts',
  '0 1 * * 0',
  $$
    SELECT net.http_post(
      url := 'http://localhost:3000/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer adswish-cron'
      ),
      body := '{"jobs":["weekly-payouts"]}'::jsonb
    );
  $$
);

-- Monthly (1st, 02:00): generate the previous month's payout invoices.
SELECT cron.schedule(
  'monthly-invoices',
  '0 2 1 * *',
  $$
    SELECT net.http_post(
      url := 'http://localhost:3000/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer adswish-cron'
      ),
      body := '{"jobs":["monthly-invoices"]}'::jsonb
    );
  $$
);
