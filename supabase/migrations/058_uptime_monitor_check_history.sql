-- 058: Local observation history for explicitly mapped UptimeRobot monitors.
--
-- Rows are written only by the service-role polling worker or the guarded local
-- demo fixture. They reflect real monitor responses; no synthetic outage rows
-- are inserted by the application.

CREATE TABLE IF NOT EXISTS public.uptime_monitor_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_profiles(user_id) ON DELETE CASCADE,
  monitor_id text NOT NULL CHECK (monitor_id ~ '^[0-9]+$'),
  status integer,
  monitor_name text,
  monitor_url text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_uptime_monitor_checks_monitor_time
  ON public.uptime_monitor_checks(monitor_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_uptime_monitor_checks_business_time
  ON public.uptime_monitor_checks(business_id, checked_at DESC);

ALTER TABLE public.uptime_monitor_checks ENABLE ROW LEVEL SECURITY;
-- Service-role-only: monitor observations are operational data and must not
-- expose monitor metadata or credentials through a browser query.

COMMENT ON TABLE public.uptime_monitor_checks IS
  'Real service-side observations of explicitly mapped UptimeRobot monitors; no synthetic incidents.';
