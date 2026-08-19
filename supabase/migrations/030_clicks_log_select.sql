-- 030_clicks_log_select.sql
-- The tracking status check needs to know whether a business's tracking links
-- have actually been used (received clicks). clicks_log had RLS enabled but no
-- SELECT policy, so user-session queries always returned empty.

DROP POLICY IF EXISTS "Users can read own clicks" ON clicks_log;

CREATE POLICY "Users can read own clicks"
  ON clicks_log FOR SELECT
  USING (
    tracking_link_id IN (
      SELECT id FROM tracking_links WHERE creator_id = auth.uid()
      UNION
      SELECT id FROM tracking_links
      WHERE campaign_id IN (SELECT id FROM campaigns WHERE business_id = auth.uid())
    )
  );
