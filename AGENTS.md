# Adswish — Project Instructions (READ THIS BEFORE ANY CHANGE)

> This file is the single source of truth for every agent (Freebuff/Buffy, GLM 5.2,
> and any other coding agent) working in this repo. **Read it fully before touching
> anything.** The rules below exist because people and agents have already made these
> mistakes — several cost real money or broke the live site.

---

## 🚨🚨 CRITICAL: LIVE STRIPE KEYS — READ BEFORE RUNNING ANYTHING

**`.env.local` currently contains LIVE Stripe keys** (`sk_live_…` / `pk_live_…`),
verified against the Stripe API, and `STRIPE_CURRENCY=gbp`. The platform account
settles in **GBP**.

### ABSOLUTELY NEVER
1. **NEVER run any `scripts/stripe-*.mjs`** (e2e/probe/lifecycle scripts) while
   `.env.local` has live keys. They create real charges, transfers, refunds, and
   connected accounts — **they move real money**. This includes:
   - `scripts/stripe-e2e.mjs`
   - `scripts/stripe-lifecycle-e2e.mjs`
   - `scripts/stripe-destination-charge-e2e.mjs`
   - `scripts/stripe-v2-probe.mjs`
   - `scripts/stripe-v2-onboarding-e2e.mjs`
2. **NEVER start the dev server and then click through a checkout/charge in the
   browser** while live keys are present — a real transaction hits the live Stripe
   account. The dev server on localhost is NOT sandboxed anymore.
3. **NEVER paste, commit, log, or echo live keys** (or any `.env.local` contents).
   `.env.local` and `vercel-env.txt` are gitignored — keep them that way. If a diff
   ever shows a real secret, STOP and remove it before committing.
4. **NEVER `npm audit fix --force`** or blindly upgrade `stripe`/`next`/`@supabase`
   packages — this app pins specific versions and the Stripe Connect v2 path uses
   preview APIs that break on SDK bumps.

### HOW TO CHECK BEFORE ANY STRIPE-TOUCHING ACTION
```bash
grep -E '^(STRIPE_SECRET_KEY|NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)=' .env.local \
  | sed -E 's/=(sk|pk)[a-z]+_.*/=<mode>/'
```
- Output shows `sk_live_` / `pk_live_` → **ABORT** any charge/transfer script.
- Output shows `sk_test_` / `pk_test_` → test mode, safe to run E2E scripts.
- If in doubt: ask the user before running anything Stripe-related.

### Stripe facts that changed recently (do not "fix" back)
- `STRIPE_CURRENCY=gbp` is env-driven via `getStripeCurrency()` in
  `src/lib/stripe/client.ts` (default `usd`). All charges/transfers/accounts/campaigns
  use it. **Do not hardcode `"usd"` back.**
- Creator onboarding uses the **Connect Accounts v2** path (`createCreatorConnectAccount`),
  with v1 account_links/transfers for the rest. Do not revert to v1 account creation.
- Off-session destination charges pass the customer's saved default payment method
  explicitly (`off_session: true` + `confirm: true`); `requires_action` charges are
  **queued** (migration 016, `charge_retries` table), not instantly reversed.
- Migration **018** enabled RLS on `subscription_plans` + `app_settings` (public
  catalog tables, public-read policies only). See DO list below.

---

## Build & Dev Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build (must pass before any push)
- `npm run lint` — ESLint (must be 0 errors)
- `npm run typecheck` — TypeScript type checking (must be clean)
- `npm run test` — Vitest unit/integration tests (must be 141+ passing)
- `npm run test:watch` — Vitest in watch mode
- `npm run test:e2e` — Playwright E2E tests
- `npm run format` — Prettier formatting
- `npm run seed:admin <email>` — Promote a user to admin

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui components
- Supabase (Postgres, Auth, Storage, Realtime)
- Stripe (Connect v2 onboarding + destination charges + transfers; Billing)
- Upstash Redis (rate limiting)
- Testing: Vitest + Playwright

## Key Conventions

- All API routes under `src/app/api/v1/` (versioned, public) or `src/app/api/internal/` (internal)
- Webhooks under `src/app/api/webhooks/`
- Tracking edge function at `src/app/t/[slug]/route.ts`
- Supabase migrations in `supabase/migrations/` — never edit via dashboard
- See `ADSWISH_MASTER_BLUEPRINT_v4.md` for the full spec, and `GLM52_HANDOFF.md`
  for the running handoff between agents (update it when you finish work)

---

## ✅ DO — every time

1. **Read `AGENTS.md`, then check `git status` before making any change.**
2. **Run the full verification gate after ANY code change, in order:**
   ```bash
   npm run typecheck && npm run lint && npm test && npm run build
   ```
   All four must pass (lint 0 errors, build exit 0) before pushing or declaring done.
3. **Check the Stripe key mode first** whenever touching anything money-related
   (see the CRITICAL section above).
4. **Add/update migrations for schema changes** in `supabase/migrations/NNN_*.sql`,
   numbered sequentially (next is 019). Apply them to the cloud DB via the Supabase
   Management API (`POST /v1/projects/{ref}/database/query` with `SUPABASE_ACCESS_TOKEN`
   from `.env.local`) — psql/supabase CLI are NOT installed here.
5. **Enable RLS on every new table** with least-privilege policies (owner CRUD +
   public-read only for genuinely public catalogs). Every existing table has RLS;
   verify with the pattern in migration 018.
6. **Use `STRIPE_CURRENCY`** (via `getStripeCurrency()`) for all Stripe calls.
7. **Update `GLM52_HANDOFF.md`** when you complete a chunk of work — what shipped,
   what's verified, what's left, and any keys/config the human must provide.
8. **Keep new work behind feature flags / no mock data in production.**
9. **Verify routes live** when practical (typecheck/tests don't catch runtime 404s).
10. **Push only after the human approves** — the user wants auto-push + auto-publish
    to Vercel, but ONLY with explicit approval per push.

## ❌ DO NOT — ever

1. **Do not run Stripe E2E/probe scripts or trigger live charges with live keys.**
2. **Do not commit `.env.local`, `vercel-env.txt`, or any secret** — check `git status`
   and `git diff` for leaks before every commit.
3. **Do not hardcode `currency: "usd"`** in Stripe calls — use `getStripeCurrency()`.
4. **Do not edit the database from the dashboard** — migrations only.
5. **Do not skip the verification gate** (typecheck → lint → test → build) to "save time."
6. **Do not revert the Stripe Connect v2 onboarding path or the 3DS retry queue**
   (migration 016) — they are deliberate, tested fixes.
7. **Do not `npm audit fix --force`** or upgrade `stripe` / `next` / `@supabase/*`
   without checking this file first — pinned versions + preview APIs.
8. **Do not assume a route/page exists without checking** — several landing-page links
   were `href="#"` until recently; verify then build.
9. **Do not run destructive commands** (resets, `git push --force`, DB truncates)
   without explicit user approval.
10. **Do not leave the dev server running from agent tooling** — the terminal tool
    kills background processes when the command finishes; tell the user to run
    `npm run dev` in their own Terminal instead.

## Money-movement flow (map for orientation)

```
Business saves card (Stripe Customer + default PM)
  → conversion webhook /api/v1/webhooks/conversion records order
  → createDestinationChargeForConversion (src/lib/finance.ts)
      → charges business card (off_session, saved default PM)
      → success: hold ledger entry (+90% creator) → pending_hold
      → requires_action: queued in charge_retries (migration 016)
      → decline/fail: markChargeFailed → refund ledger, conversion refunded
  → release-holds cron (after 7-day hold) → transfer 90% to creator Connect acct
  → generateMonthlyInvoices → payout_invoices
```

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

