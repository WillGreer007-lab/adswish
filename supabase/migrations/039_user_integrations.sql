-- Per-user optional integrations: businesses/creators add an available
-- integration to reserve a slot (counts toward their plan limit) and can
-- remove it again. Owner-only rows, RLS on.

CREATE TABLE IF NOT EXISTS public.user_integrations (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_key text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, integration_key)
);

CREATE INDEX IF NOT EXISTS idx_user_integrations_user
  ON public.user_integrations(user_id, added_at);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their integrations"
  ON public.user_integrations FOR ALL
  USING (auth.uid() = user_id);
