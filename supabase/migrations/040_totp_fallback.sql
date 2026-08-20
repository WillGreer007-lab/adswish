-- QR-code (authenticator app) signup/login fallback — used when email codes
-- can't be delivered. The app stores the TOTP secret itself so it can verify
-- 6-digit codes without relying on Supabase MFA (which requires a session).

-- One row per user who signed up via the authenticator flow (or migrated).
CREATE TABLE IF NOT EXISTS public.totp_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Half-finished QR signups (QR shown, code not yet entered). Keyed by email,
-- expires quickly so abandoned scans don't linger.
CREATE TABLE IF NOT EXISTS public.totp_pending (
  email text PRIMARY KEY,
  secret text NOT NULL,
  role text NOT NULL CHECK (role IN ('creator', 'business')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- Deny-all: both tables are touched exclusively through the service role
-- (the API routes in src/app/api/internal/auth/). No user-facing policies.
ALTER TABLE public.totp_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.totp_pending ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_totp_pending_expires
  ON public.totp_pending(expires_at);
