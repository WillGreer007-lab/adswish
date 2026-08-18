-- 011: Production-safe cron trigger.
--
-- Migrations 005 + 009 hardcoded http://localhost:3000 as the cron target, which
-- can never reach a deployed app. This adds a single app_settings entry that all
-- schedules read at execution time, so the base URL is a one-line change:
--
--   UPDATE public.app_settings SET value = 'https://your-deployed-url' WHERE key = 'cron_base_url';

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (key, value)
VALUES ('cron_base_url', 'http://localhost:3000')
ON CONFLICT (key) DO NOTHING;

-- Drop the hardcoded-URL schedules and recreate them reading the setting.
SELECT cron.unschedule('check-deliverable-deadlines');
SELECT cron.unschedule('check-sla-disputes');
SELECT cron.unschedule('check-subscription-dunning');
SELECT cron.unschedule('check-campaign-completion');
SELECT cron.unschedule('release-expired-holds');
SELECT cron.unschedule('weekly-creator-payouts');
SELECT cron.unschedule('monthly-invoices');

SELECT cron.schedule(
  'check-deliverable-deadlines',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT value FROM public.app_settings WHERE key = 'cron_base_url') || '/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer adswish-cron'
      ),
      body := '{}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'check-sla-disputes',
  '15 * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT value FROM public.app_settings WHERE key = 'cron_base_url') || '/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer adswish-cron'
      ),
      body := '{}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'check-subscription-dunning',
  '0 0 * * *',
  $$
    SELECT net.http_post(
      url := (SELECT value FROM public.app_settings WHERE key = 'cron_base_url') || '/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer adswish-cron'
      ),
      body := '{}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'check-campaign-completion',
  '30 * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT value FROM public.app_settings WHERE key = 'cron_base_url') || '/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer adswish-cron'
      ),
      body := '{}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'release-expired-holds',
  '45 * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT value FROM public.app_settings WHERE key = 'cron_base_url') || '/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer adswish-cron'
      ),
      body := '{"jobs":["release-holds"]}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'weekly-creator-payouts',
  '0 1 * * 0',
  $$
    SELECT net.http_post(
      url := (SELECT value FROM public.app_settings WHERE key = 'cron_base_url') || '/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer adswish-cron'
      ),
      body := '{"jobs":["weekly-payouts"]}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'monthly-invoices',
  '0 2 1 * *',
  $$
    SELECT net.http_post(
      url := (SELECT value FROM public.app_settings WHERE key = 'cron_base_url') || '/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer adswish-cron'
      ),
      body := '{"jobs":["monthly-invoices"]}'::jsonb
    );
  $$
);
