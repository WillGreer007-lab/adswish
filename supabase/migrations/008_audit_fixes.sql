-- 008: Audit fixes (phase 0-3 sweep)
-- RLS was enabled on these tables but no SELECT policy existed,
-- so owners could never read their own data.

-- payout_invoices: creator reads own invoices
DROP POLICY IF EXISTS "Creators can read own payout invoices" ON payout_invoices;
CREATE POLICY "Creators can read own payout invoices"
  ON payout_invoices FOR SELECT
  USING (creator_id = auth.uid());

-- message_reads: user marks/reads own
DROP POLICY IF EXISTS "Users can manage own message reads" ON message_reads;
CREATE POLICY "Users can manage own message reads"
  ON message_reads FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
