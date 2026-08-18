-- Adswish Initial Schema Migration
-- Creates: extensions, profiles, social accounts, team members, subscriptions

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- Core Profiles
-- ============================================

CREATE TABLE IF NOT EXISTS business_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  logo_url text,
  bio text DEFAULT '',
  account_status text NOT NULL DEFAULT 'pending' CHECK (account_status IN ('active', 'suspended', 'banned', 'pending')),
  strikes integer NOT NULL DEFAULT 0,
  average_rating numeric(3,2) NOT NULL DEFAULT 0.00,
  verified_domain text,
  kyb_status text NOT NULL DEFAULT 'not_required' CHECK (kyb_status IN ('pending', 'verified', 'rejected', 'not_required')),
  tax_jurisdiction text,
  tax_id text,
  paused_at timestamptz,
  paused_by uuid,
  deleted_at timestamptz,
  campaigns_created_this_month integer NOT NULL DEFAULT 0,
  campaigns_created_month text NOT NULL DEFAULT '',
  onboarding_step text NOT NULL DEFAULT 'company_info',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_business_profiles
  BEFORE UPDATE ON business_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS creator_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  profile_picture_url text,
  bio text DEFAULT '',
  account_status text NOT NULL DEFAULT 'pending' CHECK (account_status IN ('active', 'suspended', 'banned', 'pending')),
  strikes integer NOT NULL DEFAULT 0,
  average_rating numeric(3,2) NOT NULL DEFAULT 0.00,
  tier text NOT NULL DEFAULT 'micro' CHECK (tier IN ('micro', 'mid', 'macro')),
  previous_tier text,
  tier_changed_at timestamptz,
  onboarding_step text NOT NULL DEFAULT 'profile_setup',
  phone_number text,
  deleted_at timestamptz,
  stripe_connect_ready boolean NOT NULL DEFAULT false,
  niches text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_creator_profiles
  BEFORE UPDATE ON creator_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS creator_social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube')),
  handle text NOT NULL,
  follower_count bigint NOT NULL DEFAULT 0,
  verified_at timestamptz,
  refresh_token text,
  refresh_token_expires_at timestamptz,
  token_expires_at timestamptz,
  access_token text,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(creator_id, platform)
);

CREATE TRIGGER set_updated_at_creator_social_accounts
  BEFORE UPDATE ON creator_social_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS manual_follower_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  platform text NOT NULL,
  screenshot_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_team_members (
  business_id uuid NOT NULL REFERENCES business_profiles(user_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  PRIMARY KEY (business_id, user_id)
);

-- ============================================
-- Subscriptions
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  slug text PRIMARY KEY,
  name text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  billing_interval text NOT NULL DEFAULT 'monthly',
  features jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO subscription_plans (slug, name, price_cents, features) VALUES
  ('creator_free', 'Free', 0, '{"max_saved_filters": 5, "instant_payout": false}'::jsonb),
  ('creator_pro', 'Pro', 500, '{"max_saved_filters": -1, "instant_payout": true, "priority_badge": true}'::jsonb),
  ('creator_premium', 'Premium', 1000, '{"max_saved_filters": -1, "instant_payout": true, "priority_badge": true, "verified_pro_badge": true}'::jsonb),
  ('business_free', 'Free', 0, '{"max_campaigns_per_month": 3}'::jsonb),
  ('business_growth', 'Growth', 700, '{"max_campaigns_per_month": -1, "team_seats": 2}'::jsonb),
  ('business_enterprise', 'Enterprise', 1500, '{"max_campaigns_per_month": -1, "team_seats": 5, "sla_guarantee": true}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS creator_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  plan_slug text NOT NULL REFERENCES subscription_plans(slug),
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_profiles(user_id) ON DELETE CASCADE,
  plan_slug text NOT NULL REFERENCES subscription_plans(slug),
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  team_seats_used integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- RLS Policies: Core Profiles
-- ============================================

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_follower_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own business profile"
  ON business_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own business profile"
  ON business_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business profile"
  ON business_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Public can read non-deleted business profiles"
  ON business_profiles FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY "Users can read own creator profile"
  ON creator_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own creator profile"
  ON creator_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own creator profile"
  ON creator_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Public can read non-deleted creator profiles"
  ON creator_profiles FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY "Creators can CRUD own social accounts"
  ON creator_social_accounts FOR ALL
  USING (auth.uid() = creator_id);

CREATE POLICY "Public can read verified social accounts"
  ON creator_social_accounts FOR SELECT
  USING (verified_at IS NOT NULL);

CREATE POLICY "Creators can CRUD own manual verifications"
  ON manual_follower_verifications FOR ALL
  USING (auth.uid() = creator_id);

-- Admin access to manual verifications is handled via the service role;
-- no user-facing admin RLS policy is defined for this table.

CREATE POLICY "Business owners can manage team members"
  ON business_team_members FOR ALL
  USING (
    auth.uid() = business_id
    OR auth.uid() IN (SELECT user_id FROM business_team_members WHERE business_id = business_team_members.business_id)
  );

CREATE POLICY "Users can read own subscriptions"
  ON creator_subscriptions FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Users can insert own subscriptions"
  ON creator_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update own subscriptions"
  ON creator_subscriptions FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Business can read own subscriptions"
  ON business_subscriptions FOR SELECT
  USING (auth.uid() = business_id);

CREATE POLICY "Business can insert own subscriptions"
  ON business_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = business_id);

CREATE POLICY "Business can update own subscriptions"
  ON business_subscriptions FOR UPDATE
  USING (auth.uid() = business_id);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX idx_creator_profiles_tier_status ON creator_profiles(tier, account_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_profiles_domain ON business_profiles(verified_domain) WHERE deleted_at IS NULL;
CREATE INDEX idx_creator_subscriptions_creator ON creator_subscriptions(creator_id, status);
CREATE INDEX idx_business_subscriptions_business ON business_subscriptions(business_id, status);
CREATE INDEX idx_business_team_members_business ON business_team_members(business_id, user_id);
CREATE INDEX idx_creator_social_accounts_creator ON creator_social_accounts(creator_id, platform);
