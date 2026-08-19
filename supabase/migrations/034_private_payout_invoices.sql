-- 034: Payout invoices contain personal financial information and must not be
-- publicly readable. Existing public URLs are normalized to storage paths so
-- the application can issue short-lived signed download URLs.

UPDATE public.payout_invoices
SET pdf_url = regexp_replace(pdf_url, '^.*/payout-invoices/', '')
WHERE pdf_url LIKE '%/payout-invoices/%';

UPDATE storage.buckets
SET public = false
WHERE id = 'payout-invoices';

DROP POLICY IF EXISTS "Public read payout invoices" ON storage.objects;
