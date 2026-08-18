# Adswish — Project Instructions

## Build & Dev Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript type checking
- `npm run test` — Vitest unit/integration tests
- `npm run test:watch` — Vitest in watch mode
- `npm run test:e2e` — Playwright E2E tests
- `npm run format` — Prettier formatting
- `npm run seed:admin <email>` — Promote a user to admin

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui components
- Supabase (Postgres, Auth, Storage, Realtime)
- Stripe (Connect Express + Billing)
- Upstash Redis (rate limiting)
- Inngest (background jobs)
- Testing: Vitest + Playwright

## Key Conventions

- All API routes under `src/app/api/v1/` (versioned, public) or `src/app/api/internal/` (internal)
- Webhooks under `src/app/api/webhooks/`
- Tracking edge function at `src/app/t/[slug]/route.ts`
- Supabase migrations in `supabase/migrations/` — never edit via dashboard
- RLS on every table, built alongside table creation
- No mock data in production — feature flags gate incomplete features
- Cursor-based pagination only (no OFFSET for tables >10k rows)
- See `ADSWISH_MASTER_BLUEPRINT_v4.md` for full spec

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
