-- 043: Account deletion self-service support
--
-- Two changes:
--   1. `reviews.reviewer_id` / `reviewee_id` become nullable so a GDPR-safe
--      deletion can REDACT the identity (set the FK to NULL) instead of letting
--      the ON DELETE CASCADE wipe out the numerical rating + date. This keeps
--      aggregate rating history intact while erasing the person behind it.
--   2. `deletion_requests` — an audit trail for every self-service deletion.
--      It has no FK to auth.users so the row survives the hard user delete.

ALTER TABLE public.reviews
  ALTER COLUMN reviewer_id DROP NOT NULL,
  ALTER COLUMN reviewee_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  role text NOT NULL CHECK (role IN ('creator', 'business', 'unknown')),
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'rejected' CHECK (status IN ('rejected', 'completed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

-- Deny-all: this is written by the service role and read only by admins via
-- the service-role client. No authenticated user may touch it.
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user ON public.deletion_requests(user_id, requested_at DESC);
