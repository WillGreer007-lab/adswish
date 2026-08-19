-- 032: Keep database defaults aligned with the live Stripe platform currency.
-- Existing historical rows are not converted; this only prevents new rows and
-- catalog records from silently claiming USD while Stripe settles in GBP.

ALTER TABLE public.campaigns
  ALTER COLUMN currency SET DEFAULT 'GBP';

ALTER TABLE public.conversions
  ALTER COLUMN currency SET DEFAULT 'GBP';

ALTER TABLE public.ledger_entries
  ALTER COLUMN currency SET DEFAULT 'GBP';

UPDATE public.subscription_plans
SET currency = 'GBP'
WHERE currency <> 'GBP';
