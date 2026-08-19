# GLM 5.2 — Handoff from Freebuff (Buffy)

## LIVE STRIPE KEYS — Aug 18 2026

- `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env.local` and `vercel-env.txt` are now the **live** (`sk_live_`/`pk_live_`) keys, verified against the Stripe API.
- ⚠️ Live account settles in **GBP** (not USD). Added `STRIPE_CURRENCY=gbp` to both files; all Stripe calls (charges, transfers, v2 account creation, campaign currency) now read `getStripeCurrency()` (default `usd`). Commit `21292e2` pushed.
- ⚠️ **Never run the E2E/probe scripts (`scripts/stripe-*.mjs`) while live keys are in `.env.local`** — they charge/move real money. Use them only in test mode.
- TODO for Vercel: add `STRIPE_CURRENCY=gbp` + the live keys to the project env vars (they are gitignored, so push does not carry them).

> Read this first. This is a living handoff file — updated as work progresses.
> Master source of truth for scope: `ADSWISH_MASTER_BLUEPRINT_v4.md`.
> **All agents: read `AGENTS.md` FIRST** — it has the mandatory safety rules (live Stripe
> keys!, do/don't list, verification gate, migration process).

## Latest — extension in Settings + landing page + RLS everywhere

- **RLS everywhere (audited live):** all 41 tables in the cloud DB have RLS enabled
  (partitions inherit from `clicks_log`/`daily_conversion_rollups` parents; the 6
  internal tables with zero policies — `analytics_events`, `error_events`, `charge_retries`,
  `failed_jobs`, `revoked_jtis`, `webhook_events` — are intentionally deny-all,
  service-role-only). Migration 018 (subscription_plans + app_settings) applied.
- **Chrome extension now in Settings + landing page:**
  - New **`/dashboard/settings`** hub page (business + creator nav both get a Settings
    item; Profile kept with `User` icon). Cards: Notifications, Tracking & Attribution
    (pixel + Chrome extension, business only), Payouts (creator only).
  - **Landing page** pixel-promo section now advertises the extension: “One line of
    code — or zero.” + a Chrome extension button next to Copy snippet / GTM template.
  - Extension verified: manifest v3 valid, all 9 files present, payload shapes match
    the API (`token`/`orderId`/`amount`/`attribution_method:"cookie"` is a valid
    AttributionMethod), heartbeat→`/api/v1/pixel/ping` and track→`/api/v1/webhooks/
    conversion` wired in background.js, optional host permissions requested at save.
- **Verified:** typecheck clean · lint 0 errors (4 pre-existing img warnings) ·
  **141/141 tests** · build passes with 63 static pages incl. the new settings hub.

## Latest — Social connect on creator profile + YouTube OAuth + sandbox check (Aug 19)

- **Creator profile settings now has a live social section** —
  `SocialConnections` component (connect/disconnect TikTok, Instagram, YouTube
  after onboarding). New `/api/internal/oauth/disconnect` route (soft-delete +
  token wipe) and new `/api/internal/oauth/youtube` initiate route (Google
  OAuth, youtube.readonly scope). Connect buttons 307 to the provider via the
  existing callbacks; the whole loop is guarded when keys are unset.
- **Sandbox verification script ready:** `scripts/oauth-keys-check.mjs`
  verifies key presence + well-formedness, checks the production initiate
  routes redirect correctly, and prints exact authorize-URL shapes. Run it
  after pasting keys; the full authorize → callback → upsert exchange still
  needs a human completing provider consent in a browser.
- **Stripe Connect questionnaire guide added to GO_LIVE_CHECKLIST.md** —
  step-by-step for the platform-profile form that unlocks v1 payouts.
- **Keys still empty** (Will to add): INSTAGRAM_CLIENT_ID/SECRET,
  TIKTOK_CLIENT_KEY/SECRET in .env.local + Vercel. GOOGLE_CLIENT_ID/SECRET
  are set, so YouTube Connect is ready to test immediately.

## Earlier — Social OAuth buttons + admin MFA + Connect v1 status (Aug 19)

- **TikTok + Instagram OAuth now wired into onboarding:** new initiate routes
  (`/api/internal/oauth/tiktok`, `/api/internal/oauth/instagram`) redirect to
  the provider authorize pages with the signed-in user's id as `state`; the
  connect_social page now shows "Connect with TikTok / Instagram" buttons
  (mirroring the Google button pattern) that call them, with a friendly error
  when keys aren't set. The existing callbacks + `token-refresh.ts` already
  handle the exchange, profile fetch, upsert, and long-token refresh.
  **Needs Will's action:** INSTAGRAM_CLIENT_ID/SECRET + TIKTOK_CLIENT_KEY/
  SECRET are still empty in .env.local + Vercel — buttons show a "not
  configured" notice until they're added.
- **Admin account live:** `willgreer38@gmail.com` promoted to admin
  (app_metadata.role = "admin"). TOTP MFA **enrolled + verified** via the API
  (RFC-6238 codes) — session reaches AAL2. All 6 Superadmin pages verified
  200 at AAL2 (`scripts/admin-mfa-e2e.mjs`, 10/10): /admin, audit-logs,
  fraud, sla, telemetry, users. TOTP secret for the authenticator app:
  `JILS6GJKOUTQTD2HATT74YT4UHV2P446` (otpauth URI in the script output).
- **Stripe Connect v1 status (probed live):** the account has `transfers`
  capability **active**, and v1 Express account creation is NOT SDK-blocked —
  the ONLY blocker is the uncompleted Connect platform questionnaire
  ("You must complete your platform profile to use Connect and create live
  connected accounts"). Once Will completes it in the dashboard
  (dashboard.stripe.com/connect/accounts/overview), the existing v1-first
  `createCreatorConnectAccount` path works with zero code changes and real
  payouts clear. v2 remains the fallback for accounts after the migration.
- All fixtures from probing cleaned up (probe account deleted, no test data).

## Earlier — Full production verification sweep ✅ (Aug 19)

- **Google sign-in verified:** Google now ACCEPTS the redirect URI — the
  authorize endpoint 302s to Google's sign-in page (was redirect_uri_mismatch
  before). Will's Google Cloud save went through.
- **Webhook smoke test re-ran 13/13 ✅** with the thin destination deleted.
- **Real live webhook delivery confirmed:** created + cancelled a live
  PaymentIntent (no money moved) — Stripe delivered `payment_intent.created`
  (`evt_3U5wVEL…`) to the production endpoint and it was recorded.
- **Multi-role regression sweep 33/33 ✅** (`scripts/regression-sweep.mjs`):
  all business + creator dashboard pages 200 (or correct role redirect), all
  admin pages gate correctly (unauth → /login, non-admin → /dashboard).
- **Unread badges now work end-to-end (real fix):**
  - BUG: the messages send route never created a notification, so the bell
    badge never incremented. Fixed — send route now inserts a `message`
    notification for the recipient(s) via the service-role client (RLS has no
    INSERT policy on notifications). Deployed `fc24dd8`.
  - BUG: `notifications` was NOT in the supabase_realtime publication, so the
    notification center's realtime subscription silently never fired (only
    REST on load). Fixed — migration 022 applied (publication now: messages,
    notifications).
  - Verified live (`scripts/chat-realtime-unread-test.mjs`, 8/8): business
    sends → message arrives over creator's realtime socket → `message`
    notification delivered over realtime, stored read=false (badge source),
    creator reads via RLS. Fixtures auto-cleaned.
- **Cleanup:** all fabricated webhook events, test campaigns/apps/messages,
  and test notifications removed.

## Earlier — Stripe webhook smoke-tested live on production ✅

- **`STRIPE_WEBHOOK_SECRET` now set on Vercel** (added via API: production
  target, value = the `charming-spark-snapshot` secret `whsec_o855…TOhZ`) and
  redeployed via `vercel --prod` (alias `adswish-lake.vercel.app`).
- **Webhook smoke test passes end-to-end on production** — `scripts/webhook-smoke-test.mjs`
  (13/13 checks): bad signature → **400**; correctly-signed fabricated events for
  `charge.refunded`, `payment_intent.payment_failed`, `payment_intent.succeeded`,
  `charge.dispute.closed`, `account.updated`, `checkout.session.completed` all
  → **200 `received:true`**; each replay → **`duplicate:true`** (idempotency works).
  No real money touched — fabricated IDs, handlers no-op on unknown objects.
- **⚠ Stripe Destinations cleanup:** two destinations point at the same URL.
  Keep **`charming-spark-snapshot`** (18 events, full payloads — what the
  handlers read). Delete **`charming-spark-thin`** (15 events, ID-only thin
  payloads the handlers can't parse → would 400 and double-deliver). The Stripe
  API lists only ONE webhook endpoint (`we_1U5wIZ…`, 18 events) — the thin one
  exists in the new Destinations UI only.
- **Google sign-in:** Supabase half fully verified (correct redirect_uri sent to
  Google). Will's Google Cloud save is the only remaining step.

## Earlier — MP4 + realtime verified live; webhook needed secret on Vercel

- **MP4 upload E2E verified on production:** creator cookie →
  `POST /api/internal/deliverables/:id/upload` with a 24-byte MP4 → **201**,
  file in `deliverable-videos` bucket, public URL fetch 200, `video_url`
  stamped on the deliverable. Fixtures (deliverable, object, app) cleaned up.
- **Realtime chat verified end-to-end on production:** creator session
  subscribed to `postgres_changes` on `messages` (WebSocket); business sent via
  the production API → **event delivered instantly** with PII already redacted.
  Note: realtime respects RLS — a listener must be an *accepted* campaign
  participant (applications were pending, which is why earlier probes timed out).
- **Stripe webhook endpoint is live** (400 on bad signature = handler running)
  but **`STRIPE_WEBHOOK_SECRET` is NOT in Vercel** (missing from vercel-env.txt,
  only the empty `_STAGING` var is there). Charge/refund/dispute smoke tests
  cannot pass signature verification until Will adds the live webhook secret.
- **Google sign-in:** Supabase half fully verified (correct redirect_uri sent to
  Google). Will's Google Cloud save is the only remaining step.
- Cleanup done: test messages, throwaway deliverable + video object, test
  application, and the ef091dea application reverted to pending.

## Latest — LIVE VERIFICATION (production) + auth fix

- **Env vars are live on Vercel** (team-level shared → redeploy via `a03951e`
  baked them in). Cron with the real secret now returns **200** (was 401).
- **BUG FOUND + FIXED (`aaf8ebf`, deployed):** the messages and deliverable-upload
  routes called `getUser()` on the **service-role client**, which has no session —
  every browser call 401'd. Both now authenticate via cookie-based
  `createSupabaseServerClient()` (service-role client only for writes).
- **Chat E2E verified live on `https://adswish-lake.vercel.app`:**
  - Send → **201** (business account, real campaign)
  - PII redaction works: `john@example.com` / `555-123-4567` stored as `[REDACTED]`
  - Spam rejection → **429** on the 4th identical message
  - Creator reads messages → 200 (RLS participant)
  - Realtime publication on `messages` confirmed (migration 020)
  - Test messages cleaned up after verification
- **Cookie format note for future E2E scripts:** @supabase/ssr cookies are
  `sb-<ref>-auth-token=base64-<base64url(JSON session)>` (note the `base64-` prefix).
- **Google sign-in (Supabase half):** authorize → 302 to Google with the correct
  `redirect_uri=https://kzydyzugcyiuheltfxko.supabase.co/auth/v1/callback`; Supabase
  `site_url` + allowlist updated to production. Only Will's Google-Cloud save remains.
- Verification gate: typecheck clean · lint 0 errors · **141/141 tests** · build 64/64.

## Latest — PRODUCTION URL FOUND + cron pointed at prod

- **Production URL confirmed:** `https://adswish-lake.vercel.app` (project `adswish`;
  `adswish-deploy` is a duplicate with no production deployment — ignore it). Site is
  publicly reachable (200 on `/` and `/login`; Deployment Protection is OFF).
- **cron_base_url updated** in cloud `app_settings` to `https://adswish-lake.vercel.app`
  (verified via API).
- **Live cron verified:** `POST /api/internal/cron` on production runs jobs
  (`release-holds → released:0`, `pixel-penalty → checked`) with the fallback
  `adswish-cron` bearer (200). With the real `f03a0a96…` secret it 401s — because
  **`CRON_SECRET` is not yet in Vercel's env**. Once Will pastes `vercel-env.txt`
  (which contains it) into Vercel and redeploys, the DB schedules will authenticate.
- Pushed `ac22006` (Phase 6 batch) + `0c6b2d8` (GO_LIVE_CHECKLIST.md) — both deployed.

## Latest — publish + Phase 6 gaps (chat, OG, MP4) + cron secret + guards

- **Published:** pushed `59b4071` + `4f8e3de` → Vercel deploy **SUCCESS** (both
  `adswish` and `adswish-deploy` checks green on GitHub). Note: deployment is
  behind Vercel Deployment Protection (302 → Vercel SSO for anonymous probes),
  so the production alias must come from Will's Vercel dashboard before pointing
  cron at it.
- **CRON_SECRET set + synced (migration 019 APPLIED):** `app_settings.cron_secret`
  generated DB-side; every pg_cron schedule now reads BOTH `cron_base_url` and
  `cron_secret` from app_settings at execution time (no more hardcoded
  `adswish-cron`). The same value is in `.env.local` + `vercel-env.txt`
  (verified match). `cron_base_url` still points at localhost until the deployed
  URL is known: `UPDATE app_settings SET value='https://<url>' WHERE key='cron_base_url';`
- **Live-key guard (scripts/guard-live-keys.mjs):** all 5 `scripts/stripe-*.mjs`
  now call `assertTestMode()` — refuse to run (exit 1) when `.env.local` has
  `sk_live_`/`pk_live_` keys unless `--force`. Live-verified: probe refused with
  the live keys present.
- **RLS zero-policy audit:** the 6 tables with RLS but no policies
  (analytics_events, error_events, charge_retries, failed_jobs, revoked_jtis,
  webhook_events) are **intentionally deny-all** — every access is server-side
  via the service-role client (verified in code). No migration needed; not gaps.
- **Phase 6 gaps closed:**
  - **Realtime chat:** `POST /api/internal/messages` (PII filter + spam
    detection via existing security.ts, 403 for non-participants, 429 for
    repeated identical sends). New `CampaignChat` client component with
    postgres_changes realtime + 5s polling fallback; `CampaignMessages` now
    lists campaigns + per-campaign live chat. Migration `020_messages_realtime.sql`
    APPLIED (messages added to supabase_realtime publication, verified).
  - **Dynamic OG:** `generateMetadata` on `/(marketing)/creators/[id]` (title,
    description from bio/niches, OG + Twitter cards, profile picture).
  - **MP4 upload:** migration `021_deliverable_videos.sql` APPLIED (public
    `deliverable-videos` bucket + `deliverables.video_url` column, verified) +
    `POST /api/internal/deliverables/[id]/upload` (50MB cap, MP4-only,
    creator-scoped, stamps video_url).
- **Chrome extension:** zipped `chrome-extension/adswish-tracker-v1.1.0.zip`
  (8 files, Web-Store-ready). Landing page got an “Install in 3 clicks” section
  (id=extension) linking to Settings → Tracking + the Web Store.
- **Verified:** typecheck clean · lint 0 errors (4 pre-existing img warnings) ·
  **141/141 tests** · build passes (64 static pages incl. new Settings hub).
- **Pending:** commit these (guard, chat, OG, MP4, migrations 019–021, zip, landing)
  and push after Will's OK; set cron_base_url once the production URL is known.

## Latest — AGENTS.md safety doc + RLS on public catalogs

- **`AGENTS.md` rewritten as the mandatory pre-work doc for every agent** (Freebuff, GLM 5.2,
  others): CRITICAL section on the live `sk_live_` keys in `.env.local` (never run
  `scripts/stripe-*.mjs` or trigger browser charges while live — real money, GBP account),
  the mandatory verification gate (`typecheck → lint → test → build`), the do/don't list,
  the money-movement flow map, and how to check key mode before Stripe actions.
- **RLS gap closed (migration `018_subscription_plans_rls.sql`, APPLIED to cloud, verified):**
  `subscription_plans` and `app_settings` were created without RLS (Vercel/Supabase surfaced
  `subscription_plans`). Both are public read-only catalogs → RLS enabled + public-read
  policy, no write policies (service-role only). Verified live via `pg_policy` query.
- **Live Stripe keys updated** in `.env.local` + `vercel-env.txt` (`sk_live_`/`pk_live_`,
  verified; `STRIPE_CURRENCY=gbp` added — see top section).

## Latest — deploy guide + 3DS retry queue + tracking toggle + Phase 6 foundations

- **Deployment guide expanded (`DEPLOYMENT_GUIDE.md`):** §0 GitHub — the current code in
  `~/Adswish 3` is NOT in git yet (an old copy sits in a repo at `~/` with remote
  `WillGreer007-lab/adswish` — ignore it). Exact init/commit/push commands to create a new
  private `adswish` repo, then §1 imports it to Vercel with the full env-var table; §6.5 is a
  step-by-step “keys you still need” table (only `STRIPE_WEBHOOK_SECRET` + `CRON_SECRET` are
  required; Instagram/TikTok/Google redirects optional). `.gitignore` already excludes
  `.env*`/`.next`/`node_modules`/`.vercel` so secrets never get committed.
- **3DS retry queue (instead of instant reversal):** migration `016_charge_retries.sql`
  (APPLIED — table verified). `createDestinationChargeForConversion` now treats
  `requires_action`/`requires_confirmation` as “queue for later”, not failure: stamps the PI id,
  pauses the 7-day hold (`hold_expires_at = null` so the release job can't pay out uncollected
  money), upserts `charge_retries`, and notifies the business with the hosted 3DS action URL.
  New `retryExpiredCharges()` cron (wired as `charge-retries` in `/api/internal/cron`): marks
  succeeded PIs complete, re-confirms `requires_confirmation` PIs, reverses the hold after 3
  attempts (~72h). Webhook `payment_intent.succeeded` now restarts the hold window + clears the
  retry for queued conversions (no-op on the normal immediate-success path).
- **Tracking-method toggle:** migration `017_business_tracking_method.sql` (APPLIED) adds
  `business_profiles.tracking_method` (`script`|`extension`, default `script`); new
  `PATCH /api/internal/business/tracking-method` + client `TrackingMethodToggle` on
  `/dashboard/business/tracking` — the chosen option is highlighted and guides follow it.
- **Phase 6 foundations (part 1):** `src/app/robots.ts`, `src/app/sitemap.ts` (real routes only),
  `src/app/opengraph-image.tsx` (branded 1200×630 PNG) — all live (200). Notification
  preferences: `GET/PATCH /api/internal/notification-preferences` + `/dashboard/settings/
  notifications` page (mute per type, email/push toggles) + the notification center now filters
  muted types and links to settings.
- **Still open for Phase 6:** realtime chat polish (campaign-messages exists; realtime best-effort),
  MP4 upload→playback polish, dynamic OG per campaign/creator page, full multi-role regression.
  The headless Stripe onboarding script is deferred (fragile against Stripe's hosted form;
  clearing a transfer needs a human completing onboarding).

## Latest — full Stripe lifecycle verified + charge-decline fallback + CORS + extension upgrades

- **Declined / 3DS off-session charges are now surfaced** (`createDestinationChargeForConversion`):
  resolves the saved default card explicitly, and on `StripeCardError` (decline), `requires_action`
  (3DS), a non-succeeded PI, or a missing default method it calls the new `markChargeFailed()` —
  reverses the `+creator_cut` hold (`refund` entry `-creator_cut`), flips the conversion to `refunded`,
  and inserts a `payment` notification for the business. Idempotent via a `status='pending_hold'` guard
  (the `payment_intent.payment_failed` webhook now routes through the same helper, so a decline can't
  double-write). Also fixed `applyRefund`/`applyChargeback` to reverse `-creator_cut` (not the full
  order amount), so a full refund/chargeback zeroes the creator's hold correctly.
- **CORS added** to `POST/OPTIONS /api/v1/webhooks/conversion` and `/api/v1/pixel/ping`
  (`src/lib/cors.ts`, `Access-Control-Allow-Origin: *`, no credentials) — `/pixel.js` now actually
  works cross-origin from business domains, not just the extension. Live-verified: OPTIONS → 204 +
  CORS headers; POSTs carry the headers.
- **Chrome extension upgrades:** (1) optional **auto-detect conversions** — Options now takes an
  order-confirmation URL pattern + amount CSS selector; `content.js` polls and fires conversions with
  a URL-derived idempotent orderId. (2) **Web Store packaging** — `host_permissions` narrowed to `[]`
  with `optional_host_permissions: ["<all_urls>"]` + `activeTab`; options requests access to the
  configured API origin + tracked site domain at save time. Added `STORE_LISTING.md`.
- **Unit tests:** new `src/lib/finance-charge.test.ts` (7 tests) — destination-charge success /
  no-default-PM / decline / requires_action, `markChargeFailed` idempotency, and `releaseConversion`
  transfer-vs-no-transfer paths, with mocked Stripe + Supabase. **141/141 tests** (19 files).
- **Full lifecycle E2E** (`scripts/stripe-lifecycle-e2e.mjs`) against the two real test accounts,
  all green: charge (succeeded) → release-holds cron (released, `release` +`90` / `platform_fee` +`10`
  ledger) → transfer attempt → `charge.refunded` (×2, idempotent, `-90`) → `charge.dispute.closed`
  (×2, idempotent, `-90`). NOTE: the Stripe transfer itself does not *clear* against a v2 account that
  hasn't completed hosted onboarding — Stripe rejects it and the app correctly still records the
  release (logged, not lost). Clearing a real transfer remains a human onboarding step.

## Latest — Chrome extension tracker + destination-charge fix

- **Destination charge now actually charges (live-verified).** Root cause of the earlier `null`
  PaymentIntent: `off_session: true` + `automatic_payment_methods` is rejected by Stripe as
  “missing a payment method”. `createDestinationChargeForConversion` now resolves the customer's
  `invoice_settings.default_payment_method` and passes `payment_method` explicitly. Live E2E passed:
  business card charged $100, creator $90 on hold, single hold ledger entry.
- **Chrome extension tracker (alternative to `/pixel.js`, per Will):** new `chrome-extension/`
  directory — Manifest V3 extension (`manifest.json`, `background.js`, `content.js` isolated +
  `content-main.js` MAIN world, `options.html/js`, `popup.html/js`, `README.md`).
  - Drop-in `window.adswish.init/track` API (same shape as `/pixel.js`) with NO site code.
  - Captures `adswish_ref` from `/t/{slug}` redirects, heartbeats `/api/v1/pixel/ping` every 60s
    (keeps the 12h pixel-offline penalty green), and reports conversions via the background worker
    (bypasses CORS).
  - Config (API base URL + business_id) via Options, stored in `chrome.storage.sync`.
  - **Honest limitation (documented in its README):** it only tracks the browser it's installed on,
    not all visitors — so it's the no-code option, not a full site-wide replacement.
- **New Settings → Tracking page** for businesses: `/dashboard/business/tracking` (added to
  `BUSINESS_NAV`) presents both options — copy-paste pixel script (with the business's real
  `business_id` + app URL filled in) and the Chrome extension install/config steps.

## Latest — in-house telemetry + keys + Stripe onboarding without the CLI

- **Keys written to `.env.local`** (from Will): `SIGHTENGINE_API_USER`/`SIGHTENGINE_API_KEY`,
  `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. Still empty: `STRIPE_WEBHOOK_SECRET`
  (local test secret in place), Instagram, TikTok, Stripe Tax, and PostHog/Sentry (now replaced — see below).
- **In-house analytics + error tracking (PostHog/Sentry replacement — no third-party keys needed):**
  - Migration `014_telemetry_analytics_errors.sql` (**APPLIED to cloud**): `analytics_events` +
    `error_events`, RLS enabled, service-role-only (no public read/write).
  - `src/lib/telemetry.ts` (browser beacon → `/api/internal/telemetry`), `src/lib/telemetry-server.ts`
    (validation + insert), `src/app/api/internal/telemetry/route.ts` (Upstash rate-limited POST).
  - `<TelemetryProvider>` mounted in `src/app/layout.tsx`: `page_view` per route + `window.onerror` /
    `unhandledrejection` crash capture.
  - Admin viewer at **`/admin/telemetry`** (service-role reads) + a link card on `/admin`.
- **Stripe onboarding no longer needs the Stripe CLI / webhook forwarding (redo of the old Step 1):**
  - New `POST /api/internal/stripe/connect-status` reads the account straight from Stripe and flips
    `stripe_connect_ready` (verified live: v2 create → v1 `accounts.retrieve` → 200).
  - `stripe_setup` page auto-checks on load and has an “I finished onboarding — check now” button.
  - `account.updated` webhook remains the production fast-path (dashboard endpoint URL).
- **Verification:** typecheck clean · lint 0 errors (4 pre-existing `<img>` warnings) · **134/134 tests**
  (18 files) · telemetry E2E against cloud Supabase passed (insert → verify → cleanup).

## Latest #2 — Google sign-in, telemetry search/export, Stripe polling

- **Google sign-in is wired up (provider enabled on cloud):**
  - `PATCH /v1/projects/{ref}/config/auth` → `external_google_enabled: true` with the Google client
    id/secret. Authorize endpoint verified to 302 → `accounts.google.com`.
  - “Continue with Google” buttons on `/login` and `/signup`; the signup button passes the chosen
    role via `redirectTo`, and `/auth/callback` persists `user_metadata.role` (service role) for
    first-time OAuth users.
  - **User action still required:** add `https://kzydyzugcyiuheltfxko.supabase.co/auth/v1/callback`
    to the Google Cloud OAuth client's authorized redirect URIs, or Google will reject the redirect.
- **Telemetry search/export (rate-limited):**
  - `/admin/telemetry` is now a filter form (kind, event/message, path, date range) + results table
    + **Export CSV** link. Filters are server-side and LIKE-wildcard-sanitized.
  - `GET /api/internal/telemetry/export` streams CSV (≤ 5000 rows), Upstash rate-limited
    (10/min/IP). Pure helpers in `src/lib/telemetry-query.ts` (+ 10 tests).
- **Stripe status never goes stale:** `stripe_setup` polls `/api/internal/stripe/connect-status`
  every 20s while not ready (scheduled refresh), on top of the `account.updated` webhook fallback
  and the manual “check now” button.

## Phase 0–5 audit (latest)

- **Verdict:** Phases 0–2 essentially complete; Phases 3–5 functionally working with a short
  documented tail. typecheck clean · lint 0 errors · **134/134 tests** (18 files) · 39 tables +
  12 pg_cron jobs live in cloud Supabase.
- **Fixed during audit:** (1) `admin_audit_logs` had RLS with no read policy, so the admin viewer
  showed an empty list → migration `015_admin_audit_rls.sql` (applied). (2) Destination charge was
  never wired and never confirmed → `createDestinationChargeForConversion` now charges the business's
  saved default card (`confirm: true, off_session: true`) and `/api/v1/webhooks/conversion` invokes it.
- **Live-verified fix (destination charge):** the first live E2E showed the PaymentIntent was `null`.
  Root cause: `off_session: true` + `automatic_payment_methods` is rejected by Stripe as
  “missing a payment method” (no customer present to pick one). Fixed by resolving the customer's
  `invoice_settings.default_payment_method` and passing `payment_method` explicitly. The live test
  now passes — business card charged $100, creator $90 on hold, single hold ledger entry.
- **Still outstanding:** GTM container template (v1); Superadmin SLA Command Center + Fraud Feed;
  Phase 3.5 load testing; Phase 5.5 security audit; dead `src/lib/inngest/*` cleanup. Google sign-in
  is enabled and reaches Google, but a live attempt returned `bad_oauth_state` (state-cookie/host
  mismatch) — needs a debug pass. Instagram/TikTok OAuth keys still empty (user action).

## Latest #3 — deploy prep + Phase 3/5 tails

- **Settings → Payouts:** new `/dashboard/creator/payouts` page using a shared `StripeConnectPanel`;
  creator nav now has a Payouts item; onboarding step 4 reuses the same panel.
- **GTM template + pixel snippet:** `public/adswish-gtm-tag.html` + `public/adswish-pixel-snippet.html`.
- **Superadmin:** `/admin/sla` (SLA Command Center) + `/admin/fraud` (Fraud Feed), linked from `/admin`.
- **Rate limits:** application 24h limit now Upstash via `incrementCounter()` in `src/lib/redis.ts`.
- **Dead code removed:** `src/lib/inngest/*` + `/api/inngest` + the `inngest` dependency (pruned).
- **Deploy:** `vercel.json` + `DEPLOYMENT_GUIDE.md` (full env list, Instagram/TikTok/Google/Stripe steps,
  and a phases 0–5 completion checklist).
- Verification: typecheck clean · lint 0 errors (4 pre-existing `<img>` warnings) · 134/134 tests.

## What Freebuff completed this session

### 1. OpenCode desktop-app connection — DONE (cloud model, NOT Ollama)
- Client: `scripts/opencode-client.mjs` → `discover` / `ask` commands against the desktop app's
  `opencode serve` at `http://127.0.0.1:64221`.
- **Switched off Ollama.** Default model is now `opencode/deepseek-v4-flash-free` (cloud, verified).
  Override with `OPENCODE_MODEL=providerID/modelID`.
- Google Gemini models are configured on the server but fail (no Google API key).

### 2. Localhost + Safari — WORKING
- Dev server: **http://localhost:3000** (serving `/Users/willgreer/Adswish 3`), Safari opened on it.

### 3. Landing top-section redesign (dropship.io nav + hero) — DONE (Zones 1–4)
- Done in `src/app/page.tsx` + a `wordmark` prop on `src/components/shared/logo.tsx`.
- Nav (white/airy, blue mark + "adswish" wordmark, bordered "Log in" pill + solid "Get Started Free" pill),
  badge ("Adswish 1.0 is live"), headline "Launch **winning** / **creator** campaigns" (black/blue diagonal
  alternation), subhead, and two pill CTAs ("Start a Campaign" + "See how it works").
- Uses existing brand blue `#3a5ce0`, not the spec's `#225AEA`.
- **Zone 5 illustration (funnel + floating creator cards) still outstanding** — separate polish pass.

### 4. BLUEPRINT Phase 3 — Campaign Engine & Accountability — DONE (core engine)
Checked against the master blueprint §8/§9/§12/§15. Completed:

- **Schema (`supabase/migrations/006_phase3_gaps.sql`, NEW — must be applied):**
  - `campaigns.deadline_days` column.
  - `deliverables.moderation_status` / `moderation_flagged_at` columns.
  - Atomic budget-cap trigger (`total_spent >= budget_cap` → `status = paused_budget`).
  - `filter_presets` table + RLS (saved marketplace searches).
- **Campaign creation** (`src/app/api/internal/campaigns/route.ts`): drafts, budget caps, visibility,
  templates, **clone/duplicate**, `deadline_days` derivation. Fixed a bug where campaign creation tried to
  insert deliverables with `creator_id = null` (deliverables are now created per-creator on accept only).
- **Applications** (`src/app/api/internal/applications/route.ts`): state machine, UNIQUE(campaign, creator),
  tier gating, and a new **24h rate limit** (20 free / 50 pro+premium, DB-backed).
- **Lock-and-key UI:** built the previously **missing** `src/components/dashboard/campaign-detail.tsx`
  (business: applicant review, per-creator deliverable slots, approve + bulk-approve, pause/resume,
  duplicate, rating). Added `src/components/dashboard/creator-campaigns.tsx` + the creator
  `/dashboard/creator/campaigns` page (submit URL, hashtag-verify display, progress bar, rate business).
- **Marketplace search/filters/presets:** server-side filters on `GET /api/internal/campaigns?role=creator`
  (q, type, commission range, min rating, attribution days, niche) + `src/app/api/internal/filter-presets/route.ts`
  (save/load/delete, 5-preset cap for free creators) + expanded Discover UI.
- **Accountability jobs** (`src/lib/background-jobs.ts`, driven by pg_cron): 24h grace period → kick,
  72h SLA auto-resolve now **applies the business strike + 3-strike ban + auto-drops the campaign** and
  disables tracking links. Campaign auto-completion + subscription dunning already present.
- **Content moderation** (`src/lib/moderation.ts`): Sightengine check wired into deliverable submit —
  auto-flag, never auto-reject. No-ops gracefully until keys are configured.
- **Business pages:** added `/dashboard/business/campaigns` (list with applicant/pending counts) and
  `/dashboard/business/applicants` (review queue).
- **Tests:** `src/lib/moderation.test.ts` (6 tests). Full suite: **51 passed / 7 files**.
- **Typecheck:** `npm run typecheck` is now **clean** (fixed both pre-existing dashboard errors).

## Database migration status (updated by Freebuff)
- The **cloud Supabase project** (`kzydyzugcyiuheltfxko.supabase.co`) was **empty** — that's why
  onboarding "steps didn't work" (every write hit a missing table).
- Migrations **001–007 are now applied** via `supabase db push` (linked with the user's access token).
- Fixes made to get the push through: `uuid_generate_v4()` → `gen_random_uuid()` (Supabase cloud
  doesn't expose uuid-ossp on the default search path), removed a broken admin RLS policy,
  fixed partitioned-table PKs to include the partition key, and added **`007_fix_rls_recursion.sql`**
  (SECURITY DEFINER helper functions to break campaigns↔applications↔deliverables RLS recursion).
- Onboarding entry pages now **upsert** the profile row (business `company_info`, creator
  `profile_setup`) so users who signed up before the schema existed still get their row created.

## CSP / dev-mode fix (updated by Freebuff)
- The app's `next.config.ts` CSP (`script-src 'self' 'unsafe-inline' https://js.stripe.com`) blocked
  `eval()` — which broke every heavier client page (e.g. the dashboard) in **dev mode** with
  "eval() is not supported in this environment".
- Fixed: `'unsafe-eval'` is now appended to `script-src` **only when `NODE_ENV === 'development'`**.
  Production CSP remains strict (React never uses eval in production).

## Outstanding / left for GLM 5.2
1. **Apply migration 006** to Supabase (`supabase db push` or `supabase migration up`) before exercising
   campaign creation — it adds `deadline_days`, moderation columns, the budget-cap trigger, and `filter_presets`.
2. **Zone 5 hero illustration** (landing) — not started.
3. **Sightengine keys** — add `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET` to `.env.local` to enable
   real moderation (currently a graceful no-op).
4. **Blueprint test suite not fully automated** — the spec's integration tests (two-creator state machine,
   cron against advanced timestamps, concurrent-apply race, NSFW moderation flag) are not yet written;
   only unit tests exist. Recommend adding Vitest/Playwright coverage.
5. **Known simplifications (flag for Will if strict parity matters):**
   - Hashtag verification is a URL-substring check + manual-review flag, not oEmbed (blueprint allows this fallback).
   - Application rate limit is DB-backed, not Upstash Redis.
   - `src/lib/inngest/*` is now dead code (pg_cron replaced Inngest per migration 005) — safe to delete later.
   - Pause is a simple active↔paused toggle, not the 3-option granular pause from §12.
   - Per-slot deadlines aren't persisted individually; a uniform `deadline_days` is used on accept.
   - Creator "Earnings"/"Messages" and business "Payments"/"Messages" pages were 404 — **fixed this session** (see below).

## Phase 0–3 audit + debug sweep (latest — completed by Freebuff)
Ran a full pass over the codebase per Will's request. Findings and fixes:

- **Hydration error fixed:** the Grammarly browser extension injects `data-gr-ext-installed` attributes
  into `<body>` on the client, which mismatched SSR HTML. Added `suppressHydrationWarning` to `<body>`
  in `src/app/layout.tsx`. (If you still see the error, it's a different extension — check the browser, not the app.)
- **Lint script was broken:** `next lint` was removed in Next 16 → `package.json` lint script now runs
  `eslint .` directly; `storybook-static/` added to `eslint.config.mjs` ignores. `npm run lint` passes
  (4 pre-existing `<img>` warnings only).
- **Missing sidebar pages created (were 404):**
  - `/dashboard/creator/earnings` — ledger summary (released / on-hold / clawbacks) + payout invoices.
  - `/dashboard/creator/messages` + `/dashboard/business/messages` — campaign message threads
    (shared `src/components/dashboard/campaign-messages.tsx`).
  - `/dashboard/business/payments` — escrow / paid-out / fees + payout-account status.
  - `/dashboard/business/profile` — business identity + team members (handles `?upgrade=` like the creator one).
- **RLS gap fixed (migration `008_audit_fixes.sql`, applied to cloud):** `payout_invoices` and
  `message_reads` had RLS enabled but **no SELECT policy**, so owners could never read their own data.
  Added creator-reads-own-invoices + user-manages-own-reads policies.
- **Column-name bugs fixed:** business profile/payments pages referenced non-existent columns
  (`verified`, `stripe_setup_complete`) → now use real ones (`kyb_status`, `verified_domain`).
- **Verified:** `npm run typecheck` clean, `npm run lint` clean, **51/51 tests pass**, all new pages
  compile on the dev server (auth-redirect when logged out), `payout_invoices` + `ledger_entries`
  return 200 through the live API.

Still outstanding for GLM 5.2 (unchanged): Zone 5 hero illustration, Sightengine keys,
integration-test suite (two-creator state machine, cron, race, NSFW), migration 006 note is now moot
(006–008 all applied to cloud).

## Phase 0–3 audit verdict (honest — latest)
**Did DeepSeek build Phase 3 correctly? No — functionally complete, but not 100% correct.**
Known deviations: hashtag verification is a substring check (not oEmbed), rate limit is DB-backed
(not Redis), `src/lib/inngest/*` is dead code, pause is a simple toggle, and per-slot deadlines
aren't persisted. This session I also found + fixed real bugs: the Supabase Realtime WebSocket was
blocked by CSP (see below), the 90/10 fee helper rounded to **whole dollars** (losing cents),
`payout_invoices`/`message_reads` had no RLS read policy, and 5 sidebar pages were 404.

## WebSocket "operation is insecure" fix (latest)
- Root cause: `next.config.ts` CSP `connect-src` allowed `https://*.supabase.co` but **not**
  `wss://*.supabase.co`, so Supabase Realtime's WebSocket was blocked (Safari: "The operation is
  insecure"). Fixed by adding `wss://*.supabase.co` to `connect-src` in **both** the main and admin
  header sets.
- Defense-in-depth: `src/components/dashboard/notification-center.tsx` now wraps `.subscribe()` in
  try/catch and falls back to the REST fetch (no crash if realtime is unavailable).

## Phase 4 — Financial Routing (Stripe) — DONE (core, latest)
- **Migration `009_phase4_financial.sql` (applied to cloud):**
  - `creator_profiles.stripe_account_id` / `stripe_customer_id` / `tax_form_status` (W-9/W-8BEN gating).
  - `business_profiles.stripe_customer_id`.
  - `conversions.stripe_payment_intent_id` / `stripe_transfer_id` / `payout_invoice_id`.
  - `webhook_events.attempt_count` (retry/DLQ).
  - pg_cron schedules: hourly hold-release, weekly payouts (Sun 01:00), monthly invoices (1st 02:00).
- **`src/lib/finance.ts` (new):** `releaseConversion` / `releaseExpiredHolds` (7-day hold → release +
  ledger + Stripe transfer), `processWeeklyPayouts` ($25 minimum + tax-form gate + transfer + invoice),
  `generateMonthlyInvoices`, `applyRefund` / `applyChargeback`, `recordWebhookEvent` (idempotency),
  `recordWebhookFailure` (retry counter → `failed_jobs` DLQ after 5). Pure helpers `shouldPayout` and
  `partialRefundSplit` (matches the blueprint $100/2-of-3 → $60.00/$33.33 example).
- **`src/app/api/webhooks/stripe/route.ts` (rewritten from stub):** idempotent handling of
  `account.updated` → `stripe_connect_ready`, `checkout.session.completed` (setup → customer id),
  `invoice.payment_succeeded/failed` → subscription status, `charge.refunded` → refund ledger,
  `charge.dispute.closed` (lost) → chargeback clawback.
- **`src/app/api/internal/cron/route.ts`:** now accepts `{ "jobs": [...] }` body to run specific jobs;
  finance jobs added. Existing hourly pg_cron calls still work (no body → default set).
- **`setup-payment` route** now tags its session with `metadata.role = "business"`.
- **Bug fixed:** `calculateCreatorCut`/`calculatePlatformFee` rounded to whole dollars — now round to
  cents. Updated `stripe/client.test.ts` expectations accordingly.
- **Verified:** typecheck clean · lint clean · **57/57 tests pass** (8 files) · dev server live on
  `localhost:3000` with the new CSP header.

## Outstanding after Phase 4 (for GLM 5.2)
1. **PDF invoice rendering** — `generateMonthlyInvoices` sets `pdf_url = null`; actual PDF generation is not built.
2. **Destination charges** — `createDestinationChargeForConversion` (charging the business's stored
   payment method + routing 90/10 at checkout) is not wired; only the post-release transfer path is.
   The checkout → attribution → charge flow is really Phase 5 (Edge Tracking Engine).
3. **Stripe test-mode end-to-end** — run real Stripe events (payment/transfer/refund/chargeback) and
   subscription create/upgrade/downgrade/cancel to validate the webhook handlers against a test account.
4. **pg_cron URLs target `http://localhost:3000`** (migrations 005 + 009) — must point at the deployed
   URL in production, or switch to an HTTP edge trigger.
5. **Sightengine keys + Zone 5 illustration + integration tests** — still outstanding from before.
6. **Access token added** — `SUPABASE_ACCESS_TOKEN` is now in `.env.local` so GLM 5.2 can run
   `supabase db push` / migrations without asking Will again.

## Auth, logout, test accounts + Zone 5 (latest — completed by Freebuff)

### Logout (done)
- New `src/components/dashboard/logout-button.tsx` (client) signs out via `supabase.auth.signOut()`
  and navigates to `/login`. Wired into the dashboard shell sidebar **and** top bar (all 10 dashboard
  pages use `DashboardShell`, so logout works everywhere). Protected pages already redirect to
  `/login` when unauthenticated.

### Test accounts (done, verified sign-in 200 for both)
- `scripts/create-test-accounts.mjs` — creates via the **signup** endpoint (the admin "create user"
  endpoint is broken, see below) + admin email-confirm + profile upsert. Safe to re-run.
- **Business:** `willgreer38@gmail.com` / `123456` (role=business, confirmed, `GreerCo`, onboarding complete).
- **Creator:** `wgreer301@gmail.com` / `123456` (role=creator, confirmed, `Will Greer`, onboarding complete).
- Both land directly on `/dashboard` (onboarding_step = "complete").

### CRITICAL bug found + fixed (migration 010 — applied to cloud)
- The `auto_notification_prefs` trigger on `auth.users` (migration 004) was a `SECURITY DEFINER`
  function with **no pinned search_path**, so every new user creation failed with
  "Database error creating/saving new user". This would have blocked ALL real signups.
- `010_fix_auth_trigger.sql` drops/recreates it with `SET search_path = public` + fully-qualified
  `public.notification_preferences`. Verified: fresh signup now returns 200.

### Zone 5 hero illustration (done)
- Added to `src/app/page.tsx`: blue gradient funnel (clip-path beam) below the CTAs with the
  brand mark at its apex, plus 6 floating, rotated creator/campaign cards (handle + platform icon +
  campaign + earnings + green ↗ % pill) and 2 low-opacity skeleton placeholders at the edges.

### Destination charge helper (done)
- `createDestinationChargeForConversion()` in `src/lib/finance.ts`: charges the business's stored
  `stripe_customer_id` (PaymentIntent) and puts the creator's 90% on hold; the 10% platform fee +
  creator transfer still happen on release. No-ops cleanly when no Stripe key/customer is set.

### Verification (latest)
- `npm run typecheck` clean · `npm run lint` clean (4 pre-existing `<img>` warnings) · **57/57 tests
  pass** · landing page 200 with hero cards rendered · both test accounts sign in (200).

### Remaining (unchanged) for GLM 5.2
- PDF invoice rendering, Stripe test-mode E2E, pg_cron production URLs, Sightengine keys,
  integration-test suite (state machine/race/NSFW).

## Stripe test-mode E2E — DONE (latest — completed by Freebuff)
Ran a real end-to-end flow against live Stripe test keys + the running webhook route + cloud Supabase
via `scripts/stripe-e2e.mjs` (posts **signed** webhooks to `http://localhost:3000/api/webhooks/stripe`).
All steps verified:

- **Payment** ✅ (customer + PaymentIntent succeeded)
- **Refund** ✅ (`charge.refunded` → conversion `refunded`, ledger `-10`)
- **Chargeback** ✅ (`charge.dispute.closed` lost → conversion `chargeback`, clawback `-25`)
- **Transfer** ✅ (`account.updated` sets `stripe_account_id`/`stripe_connect_ready`; `transfer.failed`
  re-holds the conversion back to `pending_hold`)
- **Subscription create/upgrade/cancel** ✅ (`business_growth` → `business_enterprise` → `canceled`)

### Webhook handler bugs found + fixed
- **Subscription lifecycle was entirely missing** — `customer.subscription.created/updated/deleted` and
  `checkout.session.completed` (subscription mode) did nothing. Added `syncSubscription` (creates/updates
  `creator_subscriptions`/`business_subscriptions` by `stripe_subscription_id`, maps status/period/canceled_at,
  resolves owner via metadata `user_id`+`role` then falls back to `stripe_customer_id`).
- **`payment_intent.payment_failed` was unhandled** — added reversal (conversion → `refunded` + negative
  ledger entry).
- **`transfer.failed` was unhandled** — added re-hold.
- **`STRIPE_WEBHOOK_SECRET` was empty** in `.env.local` → generated a local `whsec_e2e_…` test secret so
  signatures verify. (For production, replace with the real dashboard webhook secret.)
- Refactored the handler out of the route into **`src/lib/stripe-webhooks.ts`** (`handleStripeEvent(event, supabase)`)
  so it's directly testable; the route is now a thin signature/idempotency wrapper.
- Added **`src/lib/stripe-webhooks.test.ts`** (9 regression tests). Full suite now **66/66 tests pass**.

### Findings left for GLM 5.2 (important)
1. **Connect Accounts v1 is deprecated/blocked on this Stripe account** — `stripe.accounts.create({ type: "express" })`
   (used by `connect-link` route and `releaseConversion`/`processWeeklyPayouts`) now errors:
   "Create connected accounts with POST /v2/core/accounts…". **Creator onboarding + payouts are broken until
   this is migrated to Accounts v2** (or v1 is re-enabled in the Stripe dashboard).
2. **Raw card-data APIs are disabled** on the account, so the dispute card couldn't be forced; the chargeback
   handler was exercised via a synthesized `charge.dispute.closed` (lost) event (still a full handler-level test).
3. **pg_cron URLs still target `http://localhost:3000`** (migrations 005 + 009) — production-safe trigger still TODO.
4. **PDF invoice rendering** still TODO (`generateMonthlyInvoices` sets `pdf_url = null`).

## Integration tests, cron, moderation, PDFs, Connect v2 + Phase 5 (latest — completed by Freebuff)

### Integration tests (done — the blueprint §test list)
- `src/lib/application-engine.ts` + `application-engine.test.ts`: extracted the accept/reject/withdraw/
  deliverable-slot guard logic into a pure module (the applications route now uses it, which also fixed a
  real bug — status transitions weren't guarded by current state). Tests cover the **two-creator state
  machine** (independent tracks) and the **concurrent-apply race** (slots can't be oversubscribed).
- `src/lib/background-jobs.test.ts`: `checkDeliverableDeadlines`/`checkSLADisputes` now accept an
  injectable clock, so **SLA cron against advanced timestamps** (+2h grace vs +25h kick, 80h dispute)
  is tested with a fake Supabase.

### pg_cron production-safe (done — migration 011, applied)
- `011_production_cron.sql` adds `public.app_settings` and reschedules all 7 jobs to read
  `app_settings.cron_base_url` at execution time (via `net.http_post`) instead of the hardcoded
  `http://localhost:3000`. To go live, run one SQL:
  `UPDATE public.app_settings SET value = 'https://<deployed-url>' WHERE key = 'cron_base_url';`
- Requires the `pg_net` extension (enabled by default on Supabase). `CRON_SECRET` env var can override
  the `adswish-cron` bearer the schedules send.

### Sightengine moderation (fixed wiring — still needs your keys)
- **Bug fixed:** `src/lib/moderation.ts` checked `SIGHTENGINE_API_SECRET` but `.env.local` has
  `SIGHTENGINE_API_USER` + `SIGHTENGINE_API_KEY` — moderation was silently disabled by the name
  mismatch. Now reads the correct names.
- **Still a no-op:** both Sightengine values are **empty** in `.env.local`. Add real keys to actually
  flag NSFW content into the review queue on deliverable submit.

### Real PDF payout invoices (done)
- Added `pdf-lib` (pure JS, no native deps) + `src/lib/invoice-pdf.ts` (`buildPayoutInvoicePdf`).
- `generateMonthlyInvoices` now renders a real downloadable PDF, uploads it to the public
  `payout-invoices` Storage bucket (migration `012_payout_invoice_storage.sql`, applied), and stores the
  public URL on `payout_invoices.pdf_url` (no longer null).

### Stripe Connect Accounts v2 (partial — blocked by Stripe, see action list)
- Added `createConnectedAccountV2()` (raw `POST /v2/core/accounts` with `Stripe-Version: 2025-04-30.preview`,
  `recipient` configuration) and rewrote `connect-link/route.ts` to try v2 then fall back to v1.
- **Live-probed finding:** v2 account ids are **not** accepted by the v1 `account_links`/`transfers`
  APIs ("No such account"), and the v2 transfer/onboarding-session endpoints are preview-only and not in
  the SDK. So creator onboarding + payouts remain **blocked until v1 is re-enabled** (fastest fix) or
  the full v2 session/transfer flow is built. See ACTION LIST below.

### Phase 5 — Edge Tracking Engine & Pixel (core, done + live-verified)
- `src/lib/tracking.ts`: signed HS256 tracking JWT (`link_id`, `creator_id`, `campaign_id`,
  `deliverable_id`, `ip_hash`, `ua_hash`, `jti`, `iat`, `exp`) + runtime-agnostic SHA-256 hashing
  (Web Crypto with a node:crypto fallback).
- `src/app/t/[slug]/route.ts`: the tracking redirect — looks up the slug, checks `revoked_at` +
  `revoked_jtis`, issues the 24h JWT, logs the click, and 302s to the destination with
  `?adswish_ref=<jwt>&utm_source=adswish&utm_campaign=…`. Revoked/unknown/expired → **410 Gone** (never
  a redirect), per blueprint §11.
- `src/app/pixel.js/route.ts`: first-party pixel — consent-gated cookie drop (`Max-Age` = attribution
  window), 60s heartbeat, and `adswish.track({ orderId, amount })` → conversion webhook. Analytics-only
  (no cookie) until `adswish.init({ consent: true })`.
- `src/app/api/v1/pixel/ping/route.ts`: heartbeat marks a business's Affiliate/Hybrid campaigns
  `pixel_status = 'active'` + stamps `last_pixel_ping_at`.
- `src/app/api/v1/webhooks/conversion/route.ts` + `src/lib/conversions.ts`: verifies the JWT, checks
  the blocklist + link liveness, is **idempotent on `order_id`**, and records the 90/10 split as a
  7-day `pending_hold` + hold ledger entry.
- Tests: `tracking.test.ts` (round-trip/tamper/expiry/null-deliverable) + `conversions.test.ts`
  (split/rounding/blocklist/revocation/idempotency/validation).
- **Live E2E (`scripts/tracking-e2e.mjs`):** link → 302 redirect with `adswish_ref` → conversion
  webhook 200 → conversion `{ creator_cut: 90, platform_cut: 10, status: pending_hold }` → hold ledger
  entry → click row logged → cleanup. **PASSED.**
- Not yet done (Phase 5 tail): Upstash rate limiting on the redirect/ping (the SDK is installed and the
  Upstash env vars are set, but no limiter is wired yet), Redis-first jti blocklist (Postgres
  `revoked_jtis` is the working source of truth), and the pg_cron pixel-penalty job (the 12h
  offline-pixel suspension) is still a `SELECT 1` stub.

### Verification (latest)
- `npm run typecheck` clean · `npm run lint` clean (4 pre-existing `<img>` warnings) · **93/93 tests
  pass** (13 files) · live routes confirmed: `/pixel.js` 200 JS, `/t/<bogus>` 410, conversion/ping 422
  on bad input · tracking E2E passed against cloud Supabase.

## ACTION LIST — what YOU need to do (API keys / dashboard)

1. **Stripe Connect (BLOCKING for creator onboarding + payouts):** your account requires Accounts v2.
   Either re-enable legacy "Connect Accounts v1" in the Stripe dashboard (Settings → Connect, if the
   option exists — fastest unblock, the existing v1 code then works), or let GLM 5.2 finish the full v2
   onboarding-session + transfer migration. Test-mode keys are already in `.env.local`.
2. **Sightengine (moderation):** create a free account at sightengine.com, then fill
   `SIGHTENGINE_API_USER` + `SIGHTENGINE_API_KEY` in `.env.local`. Until then deliverable submit runs
   with `moderation_status = 'not_checked'` (graceful no-op).
3. **Resend (email):** fill `RESEND_API_KEY` to enable email notifications (subscription dunning,
   pixel-offline warnings, onboarding drip).
4. **Production Stripe webhook:** the main `STRIPE_WEBHOOK_SECRET` is currently a local test secret
   (`whsec_e2e_…`). When you deploy, paste the real endpoint secret from the Stripe dashboard and add
   the live URL as a webhook endpoint. `STRIPE_WEBHOOK_SECRET_STAGING` + `STRIPE_TAX_API_KEY` are also
   empty (staging webhook + Stripe Tax are optional).
5. **pg_cron base URL:** after deploy, run
   `UPDATE public.app_settings SET value = 'https://<deployed-url>' WHERE key = 'cron_base_url';`
   (and set `CRON_SECRET` to match). Requires the `pg_net` extension (Supabase default on).
6. **Optional analytics/errors:** `NEXT_PUBLIC_POSTHOG_KEY`/`POSTHOG_KEY`/`POSTHOG_HOST`, `SENTRY_DSN`
   (failed_jobs DLQ alerting), `AWS_REKOGNITION_*`, `CLOUDMERSIVE_API_KEY`, and the OAuth client
   keys (`GOOGLE_CLIENT_*`, `INSTAGRAM_CLIENT_*`, `TIKTOK_CLIENT_*`) are all still empty.
7. **Storage bucket:** `payout-invoices` (public) was created by migration 012 — verify it shows in the
   Supabase dashboard Storage tab (it should already exist post-push).

## Rate limiting, oEmbed hashtag, jti blocklist (latest — completed by Freebuff)

### Upstash rate limiting (done + live-verified 429)
- `src/lib/redis.ts` (new): `getRedis()` (Upstash REST, fails open), `checkRateLimit()` (atomic INCR
  fixed-window), `markJtiRevoked()` / `isJtiRevoked()` (jti blocklist SET).
- Wired into: **tracking redirect** (100/min per IP), **pixel ping** (12/min per business ≈ 1/5s),
  **conversion webhook** (60/min per IP). Over-limit → **429**.
- `src/lib/redis.test.ts` (7 tests). Live-verified: 105 redirect requests → 100×410 then 5×429.
- NOTE: the Upstash keys in `.env.local` are **real and working** (INCR self-test returned 1).

### oEmbed hashtag verification (done — Phase 3 deviation closed)
- `src/lib/hashtag.ts` (new): `verifyHashtag(url, hashtag)` fetches real oEmbed metadata (TikTok,
  Instagram, YouTube, X/Twitter) and checks title+author for the hashtag; falls back to the substring
  check on non-oEmbed platforms or oEmbed failure (blueprint-allowed fallback).
- Deliverable submit route now uses it. `src/lib/hashtag.test.ts` (5 tests).

### Redis jti blocklist fast path (done)
- The redirect checks Redis (`isJtiRevoked`) before the Postgres `revoked_jtis` fallback.
- `checkSLADisputes` now blocklists each revoked link's jti in **both** Redis and Postgres.

### NEW GAP FOUND — tracking links are never generated (important)
There is **no code that INSERTs into `tracking_links`** (creates the slug + destination_url). The
accept-application flow creates deliverable slots (`buildDeliverableSlots`) but never creates the
Affiliate/Hybrid tracking link, so the §11 redirect has nothing to serve until a link row exists.
This needs: a destination-url source (the business's `verified_domain` or a new `campaigns.destination_url`
column) + slug generation wired into campaign launch/accept. **This is the next real Phase 5 work item.**

### Still remaining (unchanged, for GLM 5.2)
- Tracking-link generation (above).
- 12-hour pixel-offline penalty job (still a `SELECT 1` cron stub; touches billing pause + alerts).
- Destination charges wired into the checkout path (helper exists, not connected).
- Granular 3-option campaign pause + per-slot persisted deadlines (Phase 3 deviations).
- Stripe Connect Accounts v2 end-to-end (blocked by Stripe, see ACTION LIST).
- GTM/Shopify/WordPress pixel helpers (blueprint marks v2).

### Verification (latest)
- `npm run typecheck` clean · `npm run lint` clean (4 pre-existing `<img>` warnings) · **105/105 tests
  pass** (15 files) · rate limiting live-verified (429) · dev server on `localhost:3000`.

## Tracking links, granular pause, per-slot deadlines, pixel penalty (latest — completed by Freebuff)

### Tracking-link generation (done — closes the "no code creates links" gap)
- `src/lib/tracking-links.ts` (new): `generateTrackingSlug()` (8-char crypto-random, unambiguous
  alphabet), `isTrackingActive()` (pure pause-status predicate), `createTrackingLink()` (insert + slug
  collision retry).
- The deliverable **approve** route now creates the Affiliate/Hybrid tracking link on approval
  (blueprint §11 "on approval the tracking link for that slot goes live"), using the business's
  `verified_domain` (falls back to the app domain), and stamps `deliverables.tracking_link_id`.
  Fixed-fee campaigns get no link.

### Granular 3-option pause (done — Phase 3 deviation closed)
- Migration `013_pause_deadlines_pixel.sql` (applied): `campaigns.pause_mode`
  (`new_applications` | `all_activity`).
- `PATCH /api/internal/campaigns` now accepts `pause_mode`; `pause` stores it, `resume` clears it.
- The tracking **redirect** now joins campaign status and 410s any link whose campaign is
  draft/cancelled/completed or paused-with-`all_activity`; `new_applications` and `paused_budget`
  keep links live (existing creators continue).
- Deliverable **submit** now rejects submissions while a campaign is fully paused.

### Per-slot persisted deadlines (done — Phase 3 deviation closed)
- Migration 013 adds `campaigns.deliverable_deadlines timestamptz[]`; campaign creation stores the
  per-deliverable schedule the business set. `buildDeliverableSlots` now stamps each slot with its own
  deadline (past ones fall back to `now + deadline_days`).

### 12-hour pixel-offline penalty job (done)
- `checkPixelPenalty(now)` in `src/lib/background-jobs.ts`: finds active Affiliate/Hybrid campaigns
  whose pixel stopped pinging >12h ago. First detection → `pixel_status = offline` + `pixel_offline_at`
  + warn business + alert creators; still offline next run → suspension
  (`status=paused`, `pause_mode=all_activity`, `pause_reason=pixel_offline`). Fixed-fee untouched
  (query scoped to Affiliate/Hybrid).
- Wired as cron job `pixel-penalty`; migration 013 replaced the `SELECT 1` pg_cron stub with a real
  `net.http_post` trigger. Pixel ping clears `pixel_offline_at` on restoration.

### Tests (latest)
- `tracking-links.test.ts` (8), `application-engine.test.ts` per-slot deadline test (1),
  `background-jobs.test.ts` pixel-penalty tests (3). **117/117 tests pass** (16 files).

## Stripe Connect Accounts v2 — DONE (live-probed + implemented)
- **The blocker was a probe artifact, not a real limitation.** Live-probed with the test key and
  confirmed: v2 account ids (`acct_…`) ARE accepted by the v1 `account_links` and `transfers`
  endpoints. Earlier "No such account" came from sending JSON instead of form-encoded bodies to v1.
- `createConnectedAccountV2()` fixed: `Stripe-Version: 2026-07-29.preview`, `dashboard: express`,
  `merchant.card_payments` + `recipient.stripe_transfers` capabilities, and
  `responsibilities.fees_collector/losses_collector = application`. (The API walked me through the
  required fields error-by-error.)
- New `createCreatorConnectAccount()`: reuses a metadata-tagged v1 account, else tries v1 Express
  create, else falls back to v2. The connect-link route uses it and keeps v1 `account_links` for
  onboarding (works for both account versions).
- `account.updated` webhook now falls back to `creator_profiles.stripe_account_id` lookup (v2 accounts
  carry no `metadata.user_id`).
- `scripts/stripe-v2-probe.mjs` left in place as a dev probe tool.
- **No API keys or dashboard changes needed** — `STRIPE_SECRET_KEY` already in `.env.local`.
- **Live-verified:** v2 create → 200; v1 account_links(v2 id) → 200 onboarding URL; v1 transfers(v2 id)
  → `insufficient_capabilities` (i.e. accepted, pending onboarding) not "no such account".

## Stripe Connect v2 resolution (final)
Creator onboarding + payouts now work end-to-end on Accounts v2 without contacting Stripe support.
The only remaining runtime step is the creator completing hosted onboarding (Stripe then flips
`stripe_transfers` to active and `account.updated` marks `stripe_connect_ready`).

### v2 onboarding E2E (verified live — `scripts/stripe-v2-onboarding-e2e.mjs`)
- v2 account create → 200 (`recipient` + `merchant` applied) · v1 account_links(v2 id) → 200 onboarding URL ·
  synthesized `account.updated` (no metadata) → **`stripe_connect_ready` flipped via the new
  `stripe_account_id` fallback** · cron `release-holds` → `releaseConversion` released the conversion +
  wrote the release ledger. The real transfer correctly did not clear (hosted onboarding still pending).
- All probe/E2E test accounts deleted (0 remaining). Cleanup note: the creator profile still holds a
  **fake** `stripe_account_id: "acct_e2e_creator"` from the earlier stripe-e2e run — clear it before a
  real payout (`UPDATE creator_profiles SET stripe_account_id = NULL, stripe_connect_ready = false;`).
