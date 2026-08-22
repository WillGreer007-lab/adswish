-- Migration 053: correct verification_campaigns.business_id FK
--
-- A prior (later-reverted) migration 052 created this table with
--   business_id REFERENCES business_profiles(user_id)
-- which does not match the code (the route stores the auth user id from
-- session.user.id) and rejects any user without a business_profiles row.
-- Fix the drift to reference auth.users(id), matching the rest of the schema.

ALTER TABLE public.verification_campaigns
  DROP CONSTRAINT IF EXISTS verification_campaigns_business_id_fkey;

ALTER TABLE public.verification_campaigns
  ADD CONSTRAINT verification_campaigns_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES auth.users(id) ON DELETE CASCADE;
