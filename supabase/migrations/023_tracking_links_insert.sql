-- ============================================
-- 023: Allow tracking-link creation on approval.
-- The deliverable approve route inserts a tracking_links row through the
-- business owner's cookie session, but tracking_links only had SELECT
-- policies — RLS silently denied the INSERT, so links were never created.
-- ============================================

DROP POLICY IF EXISTS "Business can create tracking links on own campaigns" ON tracking_links;
CREATE POLICY "Business can create tracking links on own campaigns"
  ON tracking_links FOR INSERT
  WITH CHECK (public.is_campaign_business(campaign_id));

-- The accept-application flow (business session) inserts deliverable slots via
-- buildDeliverableSlots — but deliverables only had SELECT/UPDATE policies, so
-- RLS silently denied the INSERT and accepted applications never created slots.
DROP POLICY IF EXISTS "Business can create deliverable slots on own campaigns" ON deliverables;
CREATE POLICY "Business can create deliverable slots on own campaigns"
  ON deliverables FOR INSERT
  WITH CHECK (public.is_campaign_business(campaign_id));
