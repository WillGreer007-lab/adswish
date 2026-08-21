-- 046: Follower re-check cron dispatch.
-- Migration 003 created 'monthly-follower-recheck' as a `SELECT 1;` stub. This
-- replaces it with the real HTTP dispatch to the app's cron route, which runs
-- `recheckFollowerCounts()` (live follower re-fetch + tier/badge recompute).

SELECT cron.unschedule('monthly-follower-recheck')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-follower-recheck');

SELECT cron.schedule(
  'monthly-follower-recheck',
  '0 0 1 * *',
  $$
    SELECT net.http_post(
      url := (SELECT value FROM public.app_settings WHERE key = 'cron_base_url') || '/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM public.app_settings WHERE key = 'cron_secret')
      ),
      body := '{"jobs":["follower-recheck"]}'::jsonb
    );
  $$
);
