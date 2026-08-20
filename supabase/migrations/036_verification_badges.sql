-- v3 verification badges: blue (verified, paid plan) and gold (1M+ followers).
ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS verified_badge boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gold_badge boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_creator_profiles_badges
  ON public.creator_profiles(verified_badge, gold_badge)
  WHERE deleted_at IS NULL;
