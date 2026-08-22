-- Migration 052: SocialVerify campaign verification system
-- Adds campaign-level verification with platform selection, token management,
-- follower thresholds, authenticity scoring, and cross-platform verification.

-- ============================================================
-- 1. verification_campaigns — one per business verification campaign
-- ============================================================
CREATE TABLE IF NOT EXISTS public.verification_campaigns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain       text,
  business_name text NOT NULL DEFAULT '',
  secret_key_hash text NOT NULL,
  status       text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','pending_verification','under_review','verified','locked')),
  selected_platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  verified_at  timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_campaigns_business
  ON public.verification_campaigns (business_id, created_at DESC);

-- ============================================================
-- 2. platform_verifications — one row per platform per campaign
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_verifications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           uuid NOT NULL REFERENCES public.verification_campaigns(id) ON DELETE CASCADE,
  platform              text NOT NULL CHECK (platform IN ('youtube','tiktok','instagram','twitter')),
  handle                text NOT NULL,
  verification_token    text NOT NULL,
  token_signature       text NOT NULL,
  token_expires_at      timestamptz NOT NULL,
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','verifying','verified','failed','expired')),
  follower_count        bigint NOT NULL DEFAULT 0,
  follower_threshold    bigint NOT NULL DEFAULT 0,
  threshold_met         boolean NOT NULL DEFAULT false,
  authenticity_score    numeric(5,1),
  cross_platform_verified boolean NOT NULL DEFAULT false,
  token_posted          boolean NOT NULL DEFAULT false,
  token_location        text,
  verified_at           timestamptz,
  last_checked_at       timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_platform_verifications_campaign
  ON public.platform_verifications (campaign_id);

-- ============================================================
-- 3. verification_campaign_audits — immutable audit log per campaign submission
-- ============================================================
CREATE TABLE IF NOT EXISTS public.verification_campaign_audits (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id               uuid NOT NULL REFERENCES public.verification_campaigns(id) ON DELETE CASCADE,
  overall_score             numeric(5,1) NOT NULL DEFAULT 0,
  status                    text NOT NULL CHECK (status IN ('verified','pending_review','failed')),
  platform_results          jsonb NOT NULL DEFAULT '{}'::jsonb,
  manifest_signature_valid  boolean NOT NULL DEFAULT false,
  cross_platform_verified   boolean NOT NULL DEFAULT false,
  identity_confidence_score numeric(5,1),
  flags                     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_campaign_audits_campaign
  ON public.verification_campaign_audits (campaign_id, created_at DESC);

-- ============================================================
-- RLS — least privilege
-- ============================================================
ALTER TABLE public.verification_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_campaign_audits ENABLE ROW LEVEL SECURITY;

-- Business owners manage their own campaigns
DROP POLICY IF EXISTS verification_campaigns_owner_all ON public.verification_campaigns;
CREATE POLICY verification_campaigns_owner_all
  ON public.verification_campaigns FOR ALL
  USING (business_id = auth.uid());

DROP POLICY IF EXISTS platform_verifications_owner_select ON public.platform_verifications;
CREATE POLICY platform_verifications_owner_select
  ON public.platform_verifications FOR SELECT
  USING (campaign_id IN (
    SELECT id FROM public.verification_campaigns
    WHERE business_id = auth.uid()
  ));

DROP POLICY IF EXISTS platform_verifications_service_insert ON public.platform_verifications;
CREATE POLICY platform_verifications_service_insert
  ON public.platform_verifications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS platform_verifications_service_update ON public.platform_verifications;
CREATE POLICY platform_verifications_service_update
  ON public.platform_verifications FOR UPDATE
  USING (true);

-- Audit logs — owner can read, service role writes, public read-only
DROP POLICY IF EXISTS verification_campaign_audits_owner_select ON public.verification_campaign_audits;
CREATE POLICY verification_campaign_audits_owner_select
  ON public.verification_campaign_audits FOR SELECT
  USING (campaign_id IN (
    SELECT id FROM public.verification_campaigns
    WHERE business_id = auth.uid()
  ));

DROP POLICY IF EXISTS verification_campaign_audits_public_read ON public.verification_campaign_audits;
CREATE POLICY verification_campaign_audits_public_read
  ON public.verification_campaign_audits FOR SELECT
  USING (true);

DROP POLICY IF EXISTS verification_campaign_audits_service_insert ON public.verification_campaign_audits;
CREATE POLICY verification_campaign_audits_service_insert
  ON public.verification_campaign_audits FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- Updated-at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at_verification_campaigns()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_verification_campaigns ON public.verification_campaigns;
CREATE TRIGGER set_updated_at_verification_campaigns
  BEFORE UPDATE ON public.verification_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_verification_campaigns();

DROP TRIGGER IF EXISTS set_updated_at_platform_verifications ON public.platform_verifications;
CREATE TRIGGER set_updated_at_platform_verifications
  BEFORE UPDATE ON public.platform_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_verification_campaigns();
