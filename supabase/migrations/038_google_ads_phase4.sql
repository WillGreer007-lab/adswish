-- Phase 4: A/B thumbnail assets (auto-extracted from approved creator
-- videos) and Google Partner credits tracking. All rows are
-- service-role-written and owner-read (RLS on, no public policies).

CREATE TABLE IF NOT EXISTS public.deliverable_ab_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  variant text NOT NULL DEFAULT 'variant_a' CHECK (variant IN ('variant_a', 'variant_b', 'variant_c')),
  source text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  image_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  error text,
  selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ab_assets_deliverable
  ON public.deliverable_ab_assets(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_ab_assets_user
  ON public.deliverable_ab_assets(user_id, selected);

ALTER TABLE public.deliverable_ab_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage ab assets"
  ON public.deliverable_ab_assets FOR ALL
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.google_ads_partner_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_applied' CHECK (status IN ('not_applied', 'applied', 'approved', 'declined')),
  credit_amount_cents bigint NOT NULL DEFAULT 50000,
  applied_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_credits_user
  ON public.google_ads_partner_credits(user_id);

ALTER TABLE public.google_ads_partner_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage partner credits"
  ON public.google_ads_partner_credits FOR ALL
  USING (auth.uid() = user_id);

-- The winning A/B asset a business picks for a campaign (used to build the
-- ad creative). The campaign row links to the chosen thumbnail.
ALTER TABLE public.google_ads_campaigns
  ADD COLUMN IF NOT EXISTS ab_asset_id uuid REFERENCES public.deliverable_ab_assets(id) ON DELETE SET NULL;
