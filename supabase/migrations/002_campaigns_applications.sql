-- Adswish Campaigns & Applications Schema
-- Creates: campaigns, applications, deliverables, tracking_links, saved_campaigns, templates

-- ============================================
-- Campaigns
-- ============================================

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  type text NOT NULL CHECK (type IN ('fixed', 'affiliate', 'hybrid')),
  commission_pct numeric(5,2),
  fixed_amount numeric(10,2),
  attribution_days integer CHECK (attribution_days >= 1 AND attribution_days <= 30),
  pixel_status text NOT NULL DEFAULT 'unverified' CHECK (pixel_status IN ('unverified', 'active', 'offline')),
  last_pixel_ping_at timestamptz,
  offline_warning_sent_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'paused_budget', 'completed', 'cancelled')),
  budget_cap numeric(10,2),
  total_spent numeric(10,2) NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'invite', 'unlisted')),
  niche text[] NOT NULL DEFAULT '{}',
  currency text NOT NULL DEFAULT 'USD',
  end_date timestamptz,
  pause_reason text,
  paused_at timestamptz,
  paused_by uuid,
  deleted_at timestamptz,
  deliverable_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_campaigns
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Applications
-- ============================================

CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  applied_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  cover_note text,
  tier_at_application text NOT NULL CHECK (tier_at_application IN ('micro', 'mid', 'macro')),
  withdrawn_at timestamptz,
  withdrawn_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, creator_id)
);

CREATE TRIGGER set_updated_at_applications
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Deliverables
-- ============================================

CREATE TABLE IF NOT EXISTS deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  slot_number integer NOT NULL,
  required_hashtag text NOT NULL,
  deadline_date timestamptz NOT NULL,
  warning_sent_at timestamptz,
  submitted_url text,
  hashtag_verified boolean NOT NULL DEFAULT false,
  business_approved boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  tracking_link_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'grace_period', 'pending_business_review', 'completed', 'kicked', 'dropped_by_business', 'auto_dropped_sla')),
  extended_deadline_at timestamptz,
  grace_period_task_id text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_deliverables
  BEFORE UPDATE ON deliverables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Tracking Links
-- ============================================

CREATE TABLE IF NOT EXISTS tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid REFERENCES deliverables(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  destination_url text NOT NULL,
  jti text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- Saved Campaigns
-- ============================================

CREATE TABLE IF NOT EXISTS saved_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(creator_id, campaign_id)
);

-- ============================================
-- Campaign Templates
-- ============================================

CREATE TABLE IF NOT EXISTS campaign_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_profiles(user_id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('fixed', 'affiliate', 'hybrid')),
  commission_pct numeric(5,2),
  fixed_amount numeric(10,2),
  attribution_days integer,
  deliverable_count integer,
  niche text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business can CRUD own campaigns"
  ON campaigns FOR ALL
  USING (auth.uid() = business_id);

CREATE POLICY "Creators can read public campaigns"
  ON campaigns FOR SELECT
  USING (visibility = 'public' AND status IN ('active', 'paused', 'paused_budget') AND deleted_at IS NULL);

CREATE POLICY "Creators can read campaigns they applied to"
  ON campaigns FOR SELECT
  USING (
    id IN (SELECT campaign_id FROM applications WHERE creator_id = auth.uid())
    AND deleted_at IS NULL
  );

CREATE POLICY "Creators can apply to campaigns"
  ON applications FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can read own applications"
  ON applications FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Business can read applications to own campaigns"
  ON applications FOR SELECT
  USING (
    campaign_id IN (SELECT id FROM campaigns WHERE business_id = auth.uid())
  );

CREATE POLICY "Business can update applications to own campaigns"
  ON applications FOR UPDATE
  USING (
    campaign_id IN (SELECT id FROM campaigns WHERE business_id = auth.uid())
  );

CREATE POLICY "Creators can update own applications"
  ON applications FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can read own deliverables"
  ON deliverables FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Business can read deliverables on own campaigns"
  ON deliverables FOR SELECT
  USING (
    campaign_id IN (SELECT id FROM campaigns WHERE business_id = auth.uid())
  );

CREATE POLICY "Creators can update own deliverable submissions"
  ON deliverables FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Business can approve deliverables on own campaigns"
  ON deliverables FOR UPDATE
  USING (
    campaign_id IN (SELECT id FROM campaigns WHERE business_id = auth.uid())
  );

CREATE POLICY "Creators can read own tracking links"
  ON tracking_links FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Business can read tracking links on own campaigns"
  ON tracking_links FOR SELECT
  USING (
    campaign_id IN (SELECT id FROM campaigns WHERE business_id = auth.uid())
  );

CREATE POLICY "Creators can save campaigns"
  ON saved_campaigns FOR ALL
  USING (auth.uid() = creator_id);

CREATE POLICY "Business can CRUD own templates"
  ON campaign_templates FOR ALL
  USING (auth.uid() = business_id);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX idx_campaigns_business_status ON campaigns(business_id, status, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_visibility_status ON campaigns(visibility, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_niche_gin ON campaigns USING GIN(niche) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_type ON campaigns(type) WHERE deleted_at IS NULL;

CREATE INDEX idx_applications_campaign_status ON applications(campaign_id, status);
CREATE INDEX idx_applications_creator_status ON applications(creator_id, status);
CREATE INDEX idx_applications_campaign_creator ON applications(campaign_id, creator_id);

CREATE INDEX idx_deliverables_campaign_creator_status ON deliverables(campaign_id, creator_id, status);
CREATE INDEX idx_deliverables_deadline_status ON deliverables(deadline_date, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_deliverables_grace_period ON deliverables(grace_period_task_id) WHERE grace_period_task_id IS NOT NULL;

CREATE INDEX idx_tracking_links_slug ON tracking_links(slug);
CREATE INDEX idx_tracking_links_jti ON tracking_links(jti) WHERE jti IS NOT NULL;

CREATE INDEX idx_saved_campaigns_creator ON saved_campaigns(creator_id, campaign_id);

CREATE INDEX idx_campaign_templates_business ON campaign_templates(business_id) WHERE deleted_at IS NULL;
