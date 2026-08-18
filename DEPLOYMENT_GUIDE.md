# Adswish — Deployment & Keys Guide

Everything you need to (1) get the code into GitHub, (2) deploy to Vercel,
(3) finish the remaining API keys, and (4) know what's left for Phase 6.
Built by Freebuff, 2026-08-18.

---

## 0. GitHub — get this code into GitHub FIRST (Vercel imports from GitHub)

> **Important:** the current app in `~/Adswish 3` is **not** in GitHub yet.
> An older copy of the project sits in a git repo at `~/` (remote
> `WillGreer007-lab/adswish`). Ignore it — **do not push from `~/`.** The real
> app needs its own repo.

1. Create the repo: github.com → **New repository** → name `adswish` (Private
   is fine). **Do NOT tick “Add a README”** (it would block the first push).
2. Open Terminal and run:
   ```bash
   cd ~/Adswish\ 3
   git init
   git add -A
   git commit -m "Adswish app — phases 0-5 + phase 6 foundations"
   git branch -M main
   git remote add origin https://github.com/<YOUR-GITHUB-USERNAME>/adswish.git
   git push -u origin main
   ```
3. Verify on github.com: you should see `src/`, `package.json`, `supabase/`,
   `chrome-extension/`, `vercel.json`, `public/` — and **no** `.env.local`
   (the `.gitignore` already excludes `.env*`, `node_modules`, `.next/`,
   `.vercel`, so secrets stay on your machine).
4. Going forward, save work with:
   ```bash
   git add -A && git commit -m "what changed" && git push
   ```

---

## 1. Deploy to Vercel

1. Push this repo to GitHub (see §0).
2. Go to https://vercel.com → **Add New → Project** → import the repo.
3. Vercel auto-detects Next.js (a `vercel.json` is already included).
4. Under **Environment Variables**, add every value from the table below
   (copy the values from your local `.env.local`).
5. Deploy. Note the production URL, e.g. `https://adswish.vercel.app`.

> **Supabase access is automatic** — Supabase is just a URL + keys in env vars,
> not a Vercel integration. You do NOT need a separate Supabase step on Vercel.

### Environment variables to set on Vercel

| Key | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | e.g. `https://kzydyzugcyiuheltfxko.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | from `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | from `.env.local` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | `pk_test_…` for now |
| `STRIPE_SECRET_KEY` | ✅ | `sk_test_…` for now |
| `STRIPE_WEBHOOK_SECRET` | ✅ | the live `whsec_…` (see §5) |
| `JWT_SIGNING_SECRET` | ✅ | from `.env.local` |
| `MESSAGE_ENCRYPTION_KEY` | ✅ | from `.env.local` |
| `NEXT_PUBLIC_APP_DOMAIN` | ✅ | your Vercel URL (used by tracking redirects/pixel) |
| `UPSTASH_REDIS_REST_URL` | ✅ | rate limiting + jti blocklist |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | from `.env.local` |
| `RESEND_API_KEY` | 🟡 | emails (dunning, alerts, onboarding) |
| `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_KEY` | 🟡 | NSFW moderation |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 🟡 | Google sign-in + YouTube follower verification |
| `INSTAGRAM_CLIENT_ID` / `INSTAGRAM_CLIENT_SECRET` | 🟡 | Instagram social connect (§3) |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | 🟡 | TikTok social connect (§4) |
| `STRIPE_TAX_API_KEY` | ⚪ | Stripe Tax (subscription/platform-fee tax) |
| `STRIPE_WEBHOOK_SECRET_STAGING` | ⚪ | separate staging endpoint |

Do **not** put these in Vercel: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`
(those are local/admin-only).

### After first deploy (3 SQL/cron steps)

1. Point the cron jobs at production:
   ```sql
   update public.app_settings set value = 'https://<your-vercel-url>' where key = 'cron_base_url';
   ```
2. Set a strong cron secret in Vercel: `CRON_SECRET=<random>`.
3. Add the production webhook endpoint in Stripe (§5).

---

## 2. Google — sign-in + YouTube verification

Your Google OAuth client is shared for **both** purposes:

1. Sign-in: already enabled on Supabase. **Required:** in Google Cloud Console →
   *APIs & Services → Credentials → your OAuth client* → **Authorized redirect
   URIs**, make sure both are present:
   - `https://kzydyzugcyiuheltfxko.supabase.co/auth/v1/callback` (Supabase sign-in)
   - `https://<your-vercel-url>/api/internal/oauth/youtube/callback` (YouTube)
2. For the YouTube follower check, enable the **YouTube Data API v3** for the
   project (APIs & Services → Library → enable).

---

## 3. Instagram OAuth keys

1. https://developers.facebook.com → **My Apps → Create App** → "Consumer".
2. Add the **Instagram API** product.
3. Go to **Instagram → Instagram Login** (or the newer *Instagram API with
   Instagram Login*) and add a test user or submit for `instagram_business_basic`
   + `pages_read_engagement` scopes.
4. Copy **Instagram App ID** and **App Secret** into `.env.local` / Vercel:
   ```
   INSTAGRAM_CLIENT_ID=<app-id>
   INSTAGRAM_CLIENT_SECRET=<app-secret>
   ```
5. Add the redirect URI (must match the app):
   ```
   https://<your-domain>/api/internal/oauth/instagram/callback
   ```
   (For local testing use `http://localhost:3000/api/internal/oauth/instagram/callback`.)

---

## 4. TikTok OAuth keys

1. https://developers.tiktok.com → **Manage apps → Connect an app**.
2. Configure **Login Kit** (scopes: `user.info.basic`, `user.info.stats`).
3. Copy the **Client key** and **Client secret**:
   ```
   TIKTOK_CLIENT_KEY=<client-key>
   TIKTOK_CLIENT_SECRET=<client-secret>
   ```
4. Add the redirect URI (must match the app):
   ```
   https://<your-domain>/api/internal/oauth/tiktok/callback
   ```
5. TikTok requires app review before login works for non-sandbox users
   (plan 4–6 weeks ahead — the code already has a manual-verification fallback).

---

## 5. Stripe webhook (production)

1. https://dashboard.stripe.com/webhooks → **Add endpoint**.
2. URL: `https://<your-vercel-url>/api/webhooks/stripe`.
3. Select the events listed in `src/lib/stripe-webhooks.ts` (account.updated,
   checkout.session.completed, invoice.*, charge.refunded, charge.dispute.closed,
   payment_intent.payment_failed, transfer.failed, customer.subscription.*).
4. Copy the `whsec_…` signing secret → `STRIPE_WEBHOOK_SECRET` on Vercel.

Creator payouts (Stripe Connect) are already working on Accounts v2; no further
Stripe dashboard action is required beyond the creator completing hosted
onboarding from **Dashboard → Payouts** (the new settings page).

---

## 6. What was just built this pass

- **Settings → Payouts** page: `/dashboard/creator/payouts` (Connect Stripe +
  auto status refresh) — same panel as onboarding step 4.
- **GTM container template**: `public/adswish-gtm-tag.html` (GTM Custom HTML tag).
- **Direct pixel snippet**: `public/adswish-pixel-snippet.html`.
- **Superadmin SLA Command Center**: `/admin/sla`.
- **Superadmin Fraud Feed**: `/admin/fraud`.
- **Upstash rate limiting** for applications (was DB-backed).
- **Deleted dead code**: `src/lib/inngest/*` + `/api/inngest` (and the `inngest`
  dependency).

---

## 6.5 Keys you still need — step-by-step summary

Only **one** key is strictly required before production webhooks work; the rest
are optional integrations already wired in code.

| # | Key | Needed for | Get it at | Time |
|---|---|---|---|---|
| 1 | `STRIPE_WEBHOOK_SECRET` | Production Stripe events (payouts, refunds, chargebacks, subs) | dashboard.stripe.com → **Developers → Webhooks → Add endpoint** → URL `https://<your-vercel-url>/api/webhooks/stripe` → pick the events listed in `src/lib/stripe-webhooks.ts` → **Reveal signing secret** (`whsec_…`) | 5 min |
| 2 | `CRON_SECRET` | Secures `/api/internal/cron` | any random string (e.g. `openssl rand -hex 32`) | 1 min |
| 3 | Instagram `INSTAGRAM_CLIENT_ID`/`_SECRET` | “Connect Instagram” social proof (optional) | developers.facebook.com → **My Apps → Create App** (Consumer) → add **Instagram API** product → copy App ID/Secret → redirect `https://<your-domain>/api/internal/oauth/instagram/callback` | 15 min + review |
| 4 | TikTok `TIKTOK_CLIENT_KEY`/`_SECRET` | “Connect TikTok” social proof (optional) | developers.tiktok.com → **Manage apps** → Login Kit → client key/secret → redirect `…/api/internal/oauth/tiktok/callback` | 15 min + app review |
| 5 | Google redirect URIs (no new key) | Google sign-in + YouTube follower check | console.cloud.google.com → **APIs & Services → Credentials** → your OAuth client → Authorized redirect URIs: add `https://kzydyzugcyiuheltfxko.supabase.co/auth/v1/callback` and `https://<your-vercel-url>/api/internal/oauth/youtube/callback`; enable **YouTube Data API v3** | 10 min |

Already set (no action): `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`STRIPE_SECRET_KEY`/`PUBLISHABLE_KEY` (test mode), `JWT_SIGNING_SECRET`,
`MESSAGE_ENCRYPTION_KEY`, `UPSTASH_REDIS_REST_URL`/`TOKEN`, `SIGHTENGINE_API_USER`/`KEY`,
`RESEND_API_KEY`, `GOOGLE_CLIENT_ID`/`SECRET` — all already in your local `.env.local`.
Copy each into Vercel’s Environment Variables (see table in §1).

---

## 7. Checklist — everything remaining to fully close Phases 0–5

### Code (Freebuff/GLM can do — no keys)
- [x] GTM container template (v1) — done
- [x] Superadmin SLA Command Center — done
- [x] Superadmin Fraud Feed — done
- [x] Upstash rate limits for applications — done
- [x] Delete dead inngest code — done
- [x] Stripe Connect in Settings — done
- [x] Destination charge wired + confirmed at conversion — done
- [ ] Live test-mode destination charge with a real saved card (browser run)
- [ ] Debug the Google `bad_oauth_state` callback (host/site_url mismatch)
- [ ] Phase 3.5 load testing (k6/Artillery) — not started
- [ ] Phase 5.5 security audit — not started

### Keys / dashboards (only you can do)
- [ ] Vercel deploy + paste the env vars (§1)
- [ ] `cron_base_url` UPDATE + `CRON_SECRET` (§1)
- [ ] Stripe webhook endpoint + `STRIPE_WEBHOOK_SECRET` (§5)
- [ ] Google: add both redirect URIs + enable YouTube Data API (§2)
- [ ] Instagram OAuth keys (§3)
- [ ] TikTok OAuth keys (§4)
- [ ] Optional: Stripe Tax key, real Stripe live keys at launch
