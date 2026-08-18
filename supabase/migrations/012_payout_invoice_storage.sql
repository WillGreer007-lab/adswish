-- 012: Public storage bucket for payout invoice PDFs.

INSERT INTO storage.buckets (id, name, public)
VALUES ('payout-invoices', 'payout-invoices', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read payout invoices" ON storage.objects;
CREATE POLICY "Public read payout invoices"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payout-invoices');
