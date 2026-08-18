-- Adswish Phase 3 — gap-filling schema
-- Adds: campaign deadline_days, deliverable moderation flags, atomic budget-cap
-- trigger, and reusable marketplace filter presets.

-- ============================================
-- Campaigns: default deadline per deliverable
-- ============================================
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS deadline_days integer NOT NULL DEFAULT 14;

-- ============================================
-- Deliverables: content moderation flags
-- ============================================
ALTER TABLE deliverables
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'not_checked'
    CHECK (moderation_status IN ('not_checked', 'pending', 'flagged', 'clean')),
  ADD COLUMN IF NOT EXISTS moderation_flagged_at timestamptz;

-- ============================================
-- Budget cap — atomic enforcement (prevents race conditions on simultaneous
-- conversions pushing total_spent past the cap while status is still active).
-- ============================================
CREATE OR REPLACE FUNCTION enforce_budget_cap()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.budget_cap IS NOT NULL
     AND NEW.total_spent >= NEW.budget_cap
     AND NEW.status = 'active' THEN
    NEW.status := 'paused_budget';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_budget_cap_trigger ON campaigns;
CREATE TRIGGER enforce_budget_cap_trigger
  BEFORE UPDATE OF total_spent ON campaigns
  FOR EACH ROW EXECUTE FUNCTION enforce_budget_cap();

-- ============================================
-- Filter presets (saved marketplace searches)
-- ============================================
CREATE TABLE IF NOT EXISTS filter_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('creator', 'business')),
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE filter_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own filter presets"
  ON filter_presets FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_filter_presets_user ON filter_presets(user_id, role);
