-- Business-side verification badges (spec §22/§24 mirrored for businesses):
--   blue (verified_badge) = paid plan (Growth/Enterprise) AND verified_domain
--   gold (gold_badge)     = Enterprise plan AND KYB verified (identity proof)
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS verified_badge boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gold_badge boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_business_profiles_badges
  ON public.business_profiles(verified_badge, gold_badge)
  WHERE deleted_at IS NULL;
