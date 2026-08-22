-- 055: Integration "notify me" waitlist.
--
-- For integrations that aren't live yet (everything except Google Ads), the
-- Integration Hub shows "Notify me". This table records who asked to be
-- notified when an integration launches, so Adswish can reach out later.

CREATE TABLE IF NOT EXISTS public.integration_waitlist (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, integration_key)
);

CREATE INDEX IF NOT EXISTS idx_integration_waitlist_user
  ON public.integration_waitlist(user_id, created_at);

ALTER TABLE public.integration_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own waitlist entries"
  ON public.integration_waitlist FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
