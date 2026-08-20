-- 035: Google Ads OAuth connections (Phase 2).
-- Stores the business's Google OAuth tokens and linked Ads customer.
--
-- SECURITY: tokens are service-role-only. RLS is enabled with NO policies, so
-- the Supabase anon/authenticated roles can never read refresh tokens. Only
-- the server (service role, which bypasses RLS) reads/writes these rows.

CREATE TABLE IF NOT EXISTS public.google_ads_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_customer_id text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.google_ads_connections ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: service role only.

CREATE INDEX IF NOT EXISTS idx_google_ads_connections_user
  ON public.google_ads_connections(user_id);
