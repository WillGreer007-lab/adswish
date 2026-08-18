-- Adswish Phase 3: pg_cron jobs replacing Inngest
-- Inngest replaced with Supabase pg_cron (no external service needed)

-- pg_cron needs the pg_net extension to make outbound HTTP calls (net.http_post).
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Hourly: check deliverable deadlines + grace periods
SELECT cron.schedule(
  'check-deliverable-deadlines',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url := 'http://localhost:3000/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer adswish-cron'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Hourly: check SLA disputes (72-hour expiry)
SELECT cron.schedule(
  'check-sla-disputes',
  '15 * * * *',
  $$
    SELECT net.http_post(
      url := 'http://localhost:3000/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer adswish-cron'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Daily at midnight: check subscription dunning (7-day grace)
SELECT cron.schedule(
  'check-subscription-dunning',
  '0 0 * * *',
  $$
    SELECT net.http_post(
      url := 'http://localhost:3000/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer adswish-cron'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Hourly: check campaign completion (auto-set completed)
SELECT cron.schedule(
  'check-campaign-completion',
  '30 * * * *',
  $$
    SELECT net.http_post(
      url := 'http://localhost:3000/api/internal/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer adswish-cron'
      ),
      body := '{}'::jsonb
    );
  $$
);
