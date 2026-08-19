-- ============================================
-- 027: Campaign creation extras + "closed" status.
-- Per-platform hashtags, an optional preview media URL, and a manual-review
-- flag. Also widens the status CHECK to include "closed" (used when a fixed
-- campaign is auto-closed for insufficient balance).
-- ============================================

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS hashtags jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS manual_review boolean NOT NULL DEFAULT false;

ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('draft', 'active', 'paused', 'paused_budget', 'completed', 'cancelled', 'closed'));
