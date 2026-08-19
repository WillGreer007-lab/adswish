-- ============================================
-- 029: Business Stripe Connect (cash-out payouts).
-- Businesses need a Connect account to receive cash-outs to their bank/card.
-- ============================================

ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_ready boolean NOT NULL DEFAULT false;
