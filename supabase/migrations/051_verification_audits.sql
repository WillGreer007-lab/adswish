-- 051: Public verification audit trail.
--
-- One append-only row per approved follower verification, so anyone can read a
-- creator's verification history from a public URL (spec: audits are publicly
-- readable, follower counts snapshotted at verification time). RLS is
-- public-read; writes go through the service role only (no client write policy).

CREATE TABLE IF NOT EXISTS public.verification_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  platform text NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'twitter')),
  handle text,
  follower_count bigint NOT NULL DEFAULT 0,
  threshold bigint NOT NULL DEFAULT 1000,
  threshold_met boolean NOT NULL DEFAULT false,
  verification_token_matched boolean NOT NULL DEFAULT false,
  tier text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_audits_creator
  ON public.verification_audits (creator_id, created_at DESC);

ALTER TABLE public.verification_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY verification_audits_public_read
  ON public.verification_audits
  FOR SELECT
  USING (true);
