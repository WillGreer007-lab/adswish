-- ============================================
-- 026: Business balance (top-up → fixed-campaign spend → cash-out).
-- Balance is a separate, pre-paid wallet. It only decreases when a business
-- spends on fixed-fee campaigns (or cashes out). No RLS write policies —
-- every mutation goes through the service-role client via API routes.
-- ============================================

ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS balance_cents bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.balance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_profiles(user_id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('topup', 'campaign_spend', 'refund', 'cashout', 'adjustment')),
  amount_cents bigint NOT NULL,
  balance_after_cents bigint NOT NULL,
  description text,
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cashout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_profiles(user_id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL,
  fee_cents bigint NOT NULL,
  net_cents bigint NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'paid', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business reads own balance transactions" ON public.balance_transactions;
CREATE POLICY "Business reads own balance transactions"
  ON public.balance_transactions FOR SELECT
  USING (business_id = auth.uid());

DROP POLICY IF EXISTS "Business reads own cashout requests" ON public.cashout_requests;
CREATE POLICY "Business reads own cashout requests"
  ON public.cashout_requests FOR SELECT
  USING (business_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_balance_transactions_business
  ON public.balance_transactions(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cashout_requests_business
  ON public.cashout_requests(business_id, created_at DESC);
