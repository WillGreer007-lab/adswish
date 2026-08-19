-- 033: Run the real daily analytics materialization job.
-- Migration 003 created a SELECT 1 placeholder; this routes the schedule to the
-- authenticated application worker using the production URL and cron secret.

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'daily-rollup-aggregation';

SELECT cron.schedule(
  'daily-rollup-aggregation',
  '5 0 * * *',
  $$
    SELECT net.http_post(
      url := (SELECT value FROM public.app_settings WHERE key = 'cron_base_url') || '/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM public.app_settings WHERE key = 'cron_secret')
      ),
      body := '{"jobs":["daily-rollup"]}'::jsonb
    )
  $$
);
