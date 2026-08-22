-- 056: Allow each business to map its verified domain to a specific
-- UptimeRobot monitor. The monitor ID is not a secret; the API key remains
-- server-side in UPTIME_ROBOT_API_KEY.

ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS uptime_robot_monitor_id text;

COMMENT ON COLUMN public.business_profiles.uptime_robot_monitor_id IS
  'Optional UptimeRobot monitor ID used by the third-party tracking check.';
