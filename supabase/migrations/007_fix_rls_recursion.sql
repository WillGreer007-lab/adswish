-- Adswish Phase 3 fix: break RLS infinite recursion.
--
-- The policies on campaigns <-> applications <-> deliverables <-> tracking_links
-- all referenced each other with inline subqueries, which Postgres rejects with
-- "infinite recursion detected in policy for relation ...".
--
-- Fix: move the cross-table checks into SECURITY DEFINER functions (which run as
-- the owner and bypass RLS), then reference those functions from the policies.

-- ============================================================
-- Helper functions (security definer, bypass RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_campaign_business(_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM campaigns WHERE id = _campaign_id AND business_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_campaign_applicant(_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM applications WHERE campaign_id = _campaign_id AND creator_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_campaign_accepted_creator(_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM applications
    WHERE campaign_id = _campaign_id AND creator_id = auth.uid() AND status = 'accepted'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_deliverable_participant(_deliverable_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM deliverables d
    WHERE d.id = _deliverable_id
      AND (d.creator_id = auth.uid() OR public.is_campaign_business(d.campaign_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tracking_link_participant(_link_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tracking_links tl
    WHERE tl.id = _link_id
      AND (tl.creator_id = auth.uid() OR public.is_campaign_business(tl.campaign_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversion_participant(_conversion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM conversions c
    JOIN tracking_links tl ON tl.id = c.tracking_link_id
    WHERE c.id = _conversion_id
      AND (tl.creator_id = auth.uid() OR public.is_campaign_business(tl.campaign_id))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_campaign_business(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_campaign_applicant(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_campaign_accepted_creator(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_deliverable_participant(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_tracking_link_participant(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_conversion_participant(uuid) TO authenticated, anon;

-- ============================================================
-- Recreate the recursive policies using the helpers
-- ============================================================

-- campaigns
DROP POLICY IF EXISTS "Creators can read campaigns they applied to" ON campaigns;
CREATE POLICY "Creators can read campaigns they applied to"
  ON campaigns FOR SELECT
  USING (public.is_campaign_applicant(id) AND deleted_at IS NULL);

-- applications
DROP POLICY IF EXISTS "Business can read applications to own campaigns" ON applications;
CREATE POLICY "Business can read applications to own campaigns"
  ON applications FOR SELECT
  USING (public.is_campaign_business(campaign_id));

DROP POLICY IF EXISTS "Business can update applications to own campaigns" ON applications;
CREATE POLICY "Business can update applications to own campaigns"
  ON applications FOR UPDATE
  USING (public.is_campaign_business(campaign_id));

-- deliverables
DROP POLICY IF EXISTS "Business can read deliverables on own campaigns" ON deliverables;
CREATE POLICY "Business can read deliverables on own campaigns"
  ON deliverables FOR SELECT
  USING (public.is_campaign_business(campaign_id));

DROP POLICY IF EXISTS "Business can approve deliverables on own campaigns" ON deliverables;
CREATE POLICY "Business can approve deliverables on own campaigns"
  ON deliverables FOR UPDATE
  USING (public.is_campaign_business(campaign_id));

-- tracking_links
DROP POLICY IF EXISTS "Business can read tracking links on own campaigns" ON tracking_links;
CREATE POLICY "Business can read tracking links on own campaigns"
  ON tracking_links FOR SELECT
  USING (public.is_campaign_business(campaign_id));

-- conversions
DROP POLICY IF EXISTS "Users can read own conversions" ON conversions;
CREATE POLICY "Users can read own conversions"
  ON conversions FOR SELECT
  USING (public.is_tracking_link_participant(tracking_link_id));

-- daily_conversion_rollups
DROP POLICY IF EXISTS "Users can read own rollups" ON daily_conversion_rollups;
CREATE POLICY "Users can read own rollups"
  ON daily_conversion_rollups FOR SELECT
  USING (creator_id = auth.uid() OR public.is_campaign_business(campaign_id));

-- messages
DROP POLICY IF EXISTS "Campaign participants can read messages" ON messages;
CREATE POLICY "Campaign participants can read messages"
  ON messages FOR SELECT
  USING (public.is_campaign_business(campaign_id) OR public.is_campaign_accepted_creator(campaign_id));

DROP POLICY IF EXISTS "Campaign participants can send messages" ON messages;
CREATE POLICY "Campaign participants can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (public.is_campaign_business(campaign_id) OR public.is_campaign_accepted_creator(campaign_id))
  );

-- sla_disputes
DROP POLICY IF EXISTS "Users can read own disputes" ON sla_disputes;
CREATE POLICY "Users can read own disputes"
  ON sla_disputes FOR SELECT
  USING (
    raised_by = auth.uid()
    OR (related_deliverable_id IS NOT NULL AND public.is_deliverable_participant(related_deliverable_id))
  );

-- ledger_entries
DROP POLICY IF EXISTS "Users can read own ledger entries" ON ledger_entries;
CREATE POLICY "Users can read own ledger entries"
  ON ledger_entries FOR SELECT
  USING (related_conversion_id IS NOT NULL AND public.is_conversion_participant(related_conversion_id));
