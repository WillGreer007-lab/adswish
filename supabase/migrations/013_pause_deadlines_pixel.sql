-- 013: Granular pause, per-slot deadlines, and pixel-offline tracking.

-- §12 granular pause: "pause new applications" (existing creators continue) vs
-- "pause all activity" (tracking links disabled, no new submissions).
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS pause_mode text
  CHECK (pause_mode IN ('new_applications', 'all_activity'));

-- §8/§12 "deadline per deliverable": persist the per-slot deadlines the business
-- set at creation so acceptance can stamp each slot individually.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS deliverable_deadlines timestamptz[] NOT NULL DEFAULT '{}';

-- §12 offline badge: records when the pixel went offline so the badge can
-- persist for 30 days after restoration.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS pixel_offline_at timestamptz;

-- Replace the §12 pixel-penalty stub (SELECT 1) with a real HTTP trigger that
-- runs checkPixelPenalty via the cron route, reading the base URL from
-- app_settings (see migration 011).
SELECT cron.unschedule('pixel-penalty-check');
SELECT cron.schedule(
  'pixel-penalty-check',
  '0 */12 * * *',
  $$
    SELECT net.http_post(
      url := (SELECT value FROM public.app_settings WHERE key = 'cron_base_url') || '/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer adswish-cron'
      ),
      body := '{"jobs":["pixel-penalty"]}'::jsonb
    );
  $$
);
