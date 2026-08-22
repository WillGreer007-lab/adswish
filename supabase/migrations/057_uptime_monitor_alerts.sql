-- 057: Monitor-only UptimeRobot outage/recovery alerts.
--
-- This migration deliberately stores only monitor IDs mapped by a business and
-- never introduces all-account or monitor-management access. The application
-- uses the server-side UPTIME_ROBOT_MONITOR_API_KEY for the mapped IDs only.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'payment',
      'application',
      'sla',
      'pixel_offline',
      'review',
      'message',
      'system',
      'uptime_outage'
    )
  );

CREATE TABLE IF NOT EXISTS public.uptime_monitor_states (
  business_id uuid NOT NULL REFERENCES public.business_profiles(user_id) ON DELETE CASCADE,
  monitor_id text NOT NULL CHECK (monitor_id ~ '^[0-9]+$'),
  last_status integer,
  last_monitor_name text,
  last_monitor_url text,
  last_checked_at timestamptz,
  outage_started_at timestamptz,
  last_alert_state text NOT NULL DEFAULT 'none' CHECK (last_alert_state IN ('none', 'up', 'down')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, monitor_id)
);

CREATE INDEX IF NOT EXISTS idx_uptime_monitor_states_checked
  ON public.uptime_monitor_states(last_checked_at DESC);

ALTER TABLE public.uptime_monitor_states ENABLE ROW LEVEL SECURITY;
-- No client policies are intentional: state is written/read by the service role
-- worker only, and monitor credentials never reach browser code.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_uptime_monitor_states'
  ) THEN
    CREATE TRIGGER set_updated_at_uptime_monitor_states
      BEFORE UPDATE ON public.uptime_monitor_states
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;

COMMENT ON TABLE public.uptime_monitor_states IS
  'Service-role-only state for outage/recovery transitions of explicitly mapped UptimeRobot monitors.';

-- Poll mapped monitors every ten minutes. The cron route performs one scoped
-- request per mapped ID and emits at most one notification per transition.
SELECT cron.unschedule('check-mapped-uptime-monitors')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-mapped-uptime-monitors'
);

SELECT cron.schedule(
  'check-mapped-uptime-monitors',
  '*/10 * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT value FROM public.app_settings WHERE key = 'cron_base_url') || '/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM public.app_settings WHERE key = 'cron_secret')
      ),
      body := '{"jobs":["uptime-monitor-alerts"]}'::jsonb
    );
  $$
);
