-- Phase 3: Google Ads campaigns, parallel-tracking templates, activity log,
-- and per-user kill-switch settings. All rows are service-role-written and
-- owner-read (RLS on, no public policies).

CREATE TABLE IF NOT EXISTS public.google_ads_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  adswish_campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  google_campaign_id text,
  google_campaign_name text,
  goal text NOT NULL DEFAULT 'search', -- search | social | pmax
  target_location text,
  daily_budget_cents bigint,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'paused', 'removed', 'tracking_injected')),
  total_spend_cents bigint NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  revenue_cents bigint NOT NULL DEFAULT 0,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_user
  ON public.google_ads_campaigns(user_id, status);

ALTER TABLE public.google_ads_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage google ads campaigns"
  ON public.google_ads_campaigns FOR ALL
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.google_ads_tracking_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.google_ads_campaigns(id) ON DELETE CASCADE,
  template_url text NOT NULL,
  final_url_suffix text,
  parallel_tracking_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_ads_tracking_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage tracking templates"
  ON public.google_ads_tracking_templates FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.google_ads_campaigns WHERE id = campaign_id
    )
  );

CREATE TABLE IF NOT EXISTS public.google_ads_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.google_ads_campaigns(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'info', -- info | success | warning | error
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_ads_activity_user
  ON public.google_ads_activity_log(user_id, created_at DESC);

ALTER TABLE public.google_ads_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read activity log"
  ON public.google_ads_activity_log FOR SELECT
  USING (auth.uid() = user_id);

-- Kill-switch thresholds live on the connection row so they apply to every
-- campaign the user creates (defaults are filled client-side).
ALTER TABLE public.google_ads_connections
  ADD COLUMN IF NOT EXISTS kill_switch jsonb NOT NULL DEFAULT '{}';
