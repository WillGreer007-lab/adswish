-- ============================================
-- 019: Production-safe cron auth.
-- The pg_cron schedules previously sent a hardcoded 'Bearer adswish-cron'.
-- Now the secret lives in app_settings.cron_secret (generated DB-side so it
-- is never committed), and every schedule reads BOTH the base URL and the
-- secret from app_settings at execution time. To rotate: UPDATE the value,
-- then set the same value as CRON_SECRET in the deployed app's env.
-- ============================================

-- Generate a fresh secret only if one doesn't already exist (idempotent).
INSERT INTO public.app_settings (key, value)
SELECT 'cron_secret', md5(random()::text || clock_timestamp()::text)
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'cron_secret');

-- Rewrite every schedule to read url + secret from app_settings.
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
        'Authorization', 'Bearer ' || (SELECT value FROM public.app_settings WHERE key = 'cron_secret')
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
        'Authorization', 'Bearer ' || (SELECT value FROM public.app_settings WHERE key = 'cron_secret')
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
        'Authorization', 'Bearer ' || (SELECT value FROM public.app_settings WHERE key = 'cron_secret')
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
        'Authorization', 'Bearer ' || (SELECT value FROM public.app_settings WHERE key = 'cron_secret')
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
        'Authorization', 'Bearer ' || (SELECT value FROM public.app_settings WHERE key = 'cron_secret')
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
        'Authorization', 'Bearer ' || (SELECT value FROM public.app_settings WHERE key = 'cron_secret')
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
        'Authorization', 'Bearer ' || (SELECT value FROM public.app_settings WHERE key = 'cron_secret')
      ),
      body := '{"jobs":["monthly-invoices"]}'::jsonb
    );
  $$
);

-- The pixel-penalty job (migration 013) uses the same hardcoded bearer —
-- reschedule it with the settings-driven secret too.
SELECT cron.unschedule('pixel-penalty-check');
SELECT cron.schedule(
  'pixel-penalty-check',
  '0 */6 * * *',
  $$
    SELECT net.http_post(
      url := (SELECT value FROM public.app_settings WHERE key = 'cron_base_url') || '/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM public.app_settings WHERE key = 'cron_secret')
      ),
      body := '{"jobs":["pixel-penalty"]}'::jsonb
    );
  $$
);
