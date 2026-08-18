-- ============================================
-- Migration 017 — business tracking method preference
-- Which tracking option the business chose (pixel script vs Chrome extension),
-- so onboarding / setup guides can follow it.
-- ============================================

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS tracking_method text NOT NULL DEFAULT 'script'
  CHECK (tracking_method IN ('script', 'extension'));
