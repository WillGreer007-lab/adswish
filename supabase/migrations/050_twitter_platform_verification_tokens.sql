-- 050: Twitter/X platform + per-platform verification tokens.
--
-- Extends the EXISTING follower-tier verification system (not a parallel one):
--   * `creator_social_accounts` and `manual_follower_verifications` accept
--     `twitter` as a fourth platform (token-in-bio + screenshot + admin review,
--     no privileged platform API — consistent with the other no-OAuth paths).
--   * `manual_follower_verifications.verification_token` records the per-account
--     proof-of-ownership code the creator must post in their bio and show in the
--     screenshot, so an admin can confirm the screenshot shows the real account.

ALTER TABLE public.creator_social_accounts
  DROP CONSTRAINT IF EXISTS creator_social_accounts_platform_check;

ALTER TABLE public.creator_social_accounts
  ADD CONSTRAINT creator_social_accounts_platform_check
  CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'twitter'));

ALTER TABLE public.manual_follower_verifications
  DROP CONSTRAINT IF EXISTS manual_follower_verifications_platform_check;

ALTER TABLE public.manual_follower_verifications
  ADD CONSTRAINT manual_follower_verifications_platform_check
  CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'twitter'));

ALTER TABLE public.manual_follower_verifications
  ADD COLUMN IF NOT EXISTS verification_token text;
