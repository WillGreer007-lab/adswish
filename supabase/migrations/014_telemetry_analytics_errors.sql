-- 014_telemetry_analytics_errors.sql
-- In-house product analytics + error tracking.
-- Replaces the PostHog / Sentry third-party integrations (both are v2/optional
-- in the blueprint) with first-party capture on Supabase so the app gets
-- pageview/funnel analytics and crash reporting without extra SaaS keys.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  path text,
  referrer text,
  session_id text,
  user_id uuid references auth.users(id) on delete set null,
  properties jsonb not null default '{}'::jsonb,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.error_events (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  stack text,
  source text,
  path text,
  user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_event_created
  on public.analytics_events (event, created_at desc);
create index if not exists idx_analytics_events_path_created
  on public.analytics_events (path, created_at desc);
create index if not exists idx_analytics_events_user_created
  on public.analytics_events (user_id, created_at desc);
create index if not exists idx_error_events_created
  on public.error_events (created_at desc);
create index if not exists idx_error_events_message_created
  on public.error_events (message, created_at desc);

-- Capture is write-only from the client's perspective: inserts happen through
-- the /api/internal/telemetry route (service role), and reads happen through
-- the admin pages (service role). No anon/authenticated policies are granted,
-- so end users can neither read raw events nor write spoofed rows directly.
alter table public.analytics_events enable row level security;
alter table public.error_events enable row level security;
