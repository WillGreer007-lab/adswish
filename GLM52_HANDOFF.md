# GLM 5.2 — Handoff from Freebuff (Buffy)

## Latest — Twitter/X + per-platform proof-of-ownership tokens (Aug 21, NOT pushed)

- **Twitter/X is a 4th platform** (migration 050, APPLIED): `creator_social_accounts`
  and `manual_follower_verifications` now accept `twitter`. It follows the existing
  follower-tier system — verification is token-in-bio + screenshot + admin review,
  no privileged API. Type unions updated in `follower-recheck.ts`,
  `oauth/token-refresh.ts`, `social-connections.tsx`, `connect_social`,
  `manual-follower-verification.tsx`, `manual-verification-review.tsx`, and the
  manual-verifications + disconnect routes. Twitter has no live re-check
  (fetchLiveCount returns null — count is set at admin approval).
- **Per-platform proof-of-ownership token** (`src/lib/verification-token.ts`):
  `deriveVerificationToken(userId, platform)` → `ADSWISH-XXXXXX` (HMAC of secret +
  user + platform). `deriveYouTubeChallengeCode` now delegates to it. The manual
  screenshot flow issues one token per platform: the creator posts it to their bio
  and shows it in the screenshot; the admin review shows the expected code so a
  copied account can't pass. `manual_follower_verifications.verification_token`
  column added (migration 050).
- **`GET /api/internal/manual-verifications`** now returns a `tokens` map (all 4
  platforms) so the creator UI can show the code before uploading.
- **NOT pushed yet** (this turn also covers commit+deploy — see next section).

---

## Latest — YouTube ownership proof, onboarding self-serve, login MFA fix, browser walkthrough (Aug 21, NOT pushed)

- **YouTube ownership proof (no impersonation):** `src/lib/youtube.ts` now
  exposes `fetchYouTubeChannel` (subscriber count + public About description)
  and `deriveYouTubeChallengeCode(userId)` (stateless HMAC code, `ADSWISH-XXXXXX`).
  `POST /api/internal/oauth/youtube/verify` fetches the live description and only
  auto-verifies when it contains the creator's code — returns 403
  `{ needs_bio_proof, code }` otherwise. A creator must paste the code into their
  channel About once. This is the honest answer to "anyone can pretend to be
  someone else": auto-verify requires proof-of-control, otherwise fall back to
  screenshot + admin review.
- **Shared component `src/components/dashboard/youtube-handle-verify.tsx`**
  (handle input + Verify + inline challenge-code guidance) is used by the
  dashboard social-connections AND the onboarding connect_social step — new
  creators verify YouTube during sign-up without OAuth. Onboarding syncs the
  verified count into the manual form so Continue picks up the auto-verified tier.
- **Manual form messaging:** a self-typed follower count is NEVER auto-verified;
  it always needs a screenshot + admin review (or the YouTube code).
- **Login MFA bug fixed (`login/page.tsx`):** password/OTP + authenticator login
  was failing with "This endpoint requires a valid Bearer token" because
  `handleMfaVerify` used a fresh sessionless `probeClient()`. Added `probeRef`
  so the MFA challenge runs against the client that actually signed in (and it's
  cleared on Back). Real product bug — 2FA login was broken.
- **Browser walkthrough `e2e/follower-verification-walkthrough.spec.ts` (3/3):**
  seeds throwaway creator + admin (admin enrolled in TOTP via API), then drives
  the REAL UI: creator uploads a screenshot → admin logs in (password + authenticator
  code) and approves → asserts verified social account + tier=macro in DB.
  Run headed: `npx playwright test e2e/follower-verification-walkthrough.spec.ts --project=chromium --headed`.
  (Needs `npx playwright install chromium` once.)
- **Admin live lookup (`admin/manual-verifications` PATCH):** approving a YouTube
  screenshot cross-checks the claimed count against a live API lookup by handle.
- **Verified:** typecheck ✓ · lint 0 errors · 202 unit tests ✓ · build ✓ ·
  walkthrough 3/3 ✓. **NOT pushed.** `YOUTUBE_API_KEY` is still EMPTY — the
  self-serve field 422s until the key is pasted (manual-screenshot path works
  without it).

---

## Latest — No-OAuth YouTube subscriber lookup (Aug 21, NOT pushed)

- **New `src/lib/youtube.ts`:** `fetchYouTubeSubscriberCount(handle)` resolves a
  public channel's subscriber count via the YouTube Data API v3 with a plain
  `YOUTUBE_API_KEY` (forHandle, legacy forUsername fallback). No OAuth, no
  consent screen. Returns null when the key is missing / channel not found.
- **Follower re-check now uses it:** the YouTube branch of `fetchLiveCount` no
  longer needs a stored access token — it resolves by handle. The re-check also
  no longer filters out accounts without an access token, so manual-verified
  YouTube rows (handle, no token) get live-refreshed monthly. TikTok/Instagram
  still require their OAuth token and are skipped when absent.
- **`YOUTUBE_API_KEY` added as an EMPTY placeholder** to `.env.local` +
  `vercel-env.txt` — paste the Google Cloud API key to activate (the lookup is
  inert until then).
- **Tests:** new `src/lib/youtube.test.ts` (4 tests: handle, username fallback,
  missing key, not found). 198 tests total.
- **Verified:** typecheck ✓ · lint 0 errors · 198 tests · build ✓.
  **NOT pushed.**

---

## Latest — Manual verification smoke test verified (Aug 21, NOT pushed)

- **`scripts/manual-verification-smoke.mjs` (7/7):** proves the zero-OAuth path
  end-to-end — throwaway creator uploads a screenshot (pending) → throwaway
  admin approves → `creator_social_accounts` row created + `verified_at` set
  (1.5M), `creator_profiles.tier` recomputed micro → macro, system notification
  sent. Cleans up fixtures + the uploaded bucket object.
- **YouTube:** OAuth connect still can't be exercised (Google consent screen +
  redirect URI not registered — the original `redirect_uri_mismatch`). BUT
  YouTube subscriber counts can be fetched WITHOUT OAuth via the YouTube Data
  API v3 with a plain API key (`channels.list` + `forHandle`). `YOUTUBE_API_KEY`
  is currently MISSING — if the user creates one, add a no-OAuth YouTube count
  fetch to the manual-verification/admin path.
- **Instagram:** `INSTAGRAM_CLIENT_ID/SECRET` still EMPTY; no official public
  API without Meta app review + OAuth. Third-party scrapers (Apify, Bright Data,
  Phantombuster) exist but are paid and ToS-gray.
- **NOT pushed.**

---

## Latest — TikTok Connect removed, manual path is primary (Aug 21, NOT pushed)

- **User decision:** skip TikTok (its dev portal requires domain verification:
  "This URL is not verified"). TikTok Connect entry points are now removed from
  the UI so they're not a dead end.
- **Onboarding `connect_social`:** the "Connect with TikTok" button was replaced
  by a "Connect with YouTube" button (Instagram button kept); manual-platform
  default is now Instagram. The TikTok option remains in the manual screenshot
  form (creators can still submit a TikTok screenshot for admin approval).
- **Dashboard `social-connections`:** the "Connect TikTok" button is hidden
  (connected TikTok accounts still show + can be disconnected); empty-state text
  now points at Instagram/YouTube + manual screenshot verification.
- **TikTok OAuth routes are left in place** (not deleted) in case the domain is
  verified later — just no longer linked from the UI.
- **Manual follower verification is the fully-working path today** (no external
  OAuth needed): screenshot → Superadmin → Follower Verification → approve.
  Instagram still needs keys; YouTube still needs the Google consent screen +
  redirect URI registered.
- **Verified:** typecheck ✓ · lint 0 errors · 194 tests · build ✓.
  **NOT pushed.**

---

## Latest — TikTok smoke test + follower re-check integration test (Aug 21, NOT pushed)

- **Live connect smoke test** `scripts/tiktok-connect-smoke.mjs` (8/8): creates a
  throwaway creator, signs in, hits `/api/internal/oauth/tiktok`, and asserts a
  307 to `tiktok.com/v2/auth/authorize` with the right client_key + scope +
  callback URI; also checks the callback handles `?error=access_denied`.
- **Follower re-check integration test** `src/lib/follower-recheck.integration.test.ts`
  (2 tests): runs the real `recheckFollowerCounts` against an in-memory DB + a
  stubbed TikTok API, proving a live count gets stamped on the social account and
  the creator's tier + badges refresh (micro → macro); also proves unconfigured
  TikTok is skipped, not failed. 194 tests total.
- **TikTok redirect URIs to register** (owner task — I cannot access the TikTok
  dashboard): local `http://localhost:3000/api/internal/oauth/tiktok/callback` and
  prod `https://adswish-lake.vercel.app/api/internal/oauth/tiktok/callback`.
- **Note:** the real TikTok authorize page needs a human login, so the smoke test
  stops at the redirect into TikTok — the follower/tier side is the integration test.
- **Verified:** typecheck ✓ · lint 0 errors · 194 tests · build ✓.
  **NOT pushed.**

---

## Latest — TikTok keys wired (Aug 21, NOT pushed)

- **TIKTOK_CLIENT_KEY + TIKTOK_CLIENT_SECRET are now SET** in both `.env.local`
  and `vercel-env.txt` (previously empty). This unblocks the whole TikTok path:
  the OAuth connect route, token refresh, and the monthly follower re-check.
- **Verified live:** `GET /api/internal/oauth/tiktok` now redirects an
  unauthenticated request to `/login` (instead of `?error=tiktok_not_configured`),
  proving the running dev server loaded the new keys.
- **No creators have connected social accounts yet** (0 rows with an access
  token), so the follower re-check has nothing to fetch until someone connects —
  but TikTok will no longer be "skipped — not configured".
- **Still EMPTY:** INSTAGRAM_CLIENT_ID/SECRET (the follower re-check keeps
  skipping Instagram until those are pasted).
- Added generic `scripts/set-env-var.mjs` (KEY VALUE pairs → both env files,
  never prints values). **NOT pushed.**

---

## Latest — Resume plan, banner everywhere, admin flow test (Aug 21, NOT pushed)

- **Resume canceled plan:** new `resume_plan` admin action + `resumePlanForAccount`
  helper (in new `src/lib/admin/account-actions.ts`). Restores the local
  subscription to `active` (features/limits/badges re-apply) and, with the
  admin's explicit confirm, calls `stripe.subscriptions.update(id, {
  cancel_at_period_end: false })` for a period-end-canceled sub. `AdminUserActions`
  shows a "Resume plan" button when the plan status is `canceled`. Migration
  **049** adds `resume_plan` to the audit-log enum (APPLIED).
- **Cancel/terminate logic extracted** into `src/lib/admin/account-actions.ts`
  (`cancelPlanForAccount`, `resumePlanForAccount`, `cancelStripeSubscription`,
  `resumeStripeSubscription`) so it's unit-testable; the admin users route now
  calls these helpers.
- **Paused-payments banner on every page:** `PaymentsPausedBanner` is now a
  client component reading the user's own `payouts_paused_at` via the browser
  client and rendered by `DashboardShell`, so it appears on all 28 dashboard
  pages. (First attempt put the fetch in DashboardShell, which broke the client
  `discover` page — reverted to a client component that works in both bundles.)
- **Integration test:** new `src/lib/admin/account-actions.test.ts` (3 tests)
  drives cancel/resume against an in-memory DB + fake Stripe — proves the local
  status flip AND that Stripe is only called when the admin confirms. 192 tests.
- **Verified:** typecheck ✓ · lint 0 errors · 192 tests · build ✓.
  Migration 049 APPLIED. **NOT pushed.**

---

## Latest — Stripe cancel, payout-pause test + banner (Aug 21, NOT pushed)

- **Stripe-side subscription cancel:** `POST /api/internal/admin/users` now
  accepts `cancel_stripe: true` for `cancel_plan` / `terminate` and calls
  `stripe.subscriptions.cancel()` on the stored `stripe_subscription_id`
  (best-effort — local cancel still proceeds, response reports
  `stripe_canceled`). `AdminUserActions` adds a second explicit confirm before
  sending it, so billing only stops when the admin intends it.
- **Payout-pause guard unit-tested:** extracted `isWeeklyPayoutBlocked(profile,
  total)` in `src/lib/finance.ts` (used by `processWeeklyPayouts`) and added 5
  tests in `finance.test.ts` proving a paused account is skipped even when
  otherwise fully eligible. 189 tests total.
- **Paused-payments banner:** new `PaymentsPausedBanner` component rendered at
  the top of the creator + business dashboard overview when
  `payouts_paused_at` is set on the profile (creator overview now also selects
  that column).
- **Verified:** typecheck ✓ · lint 0 errors · 189 tests · build ✓.
  **NOT pushed.**

---

## Latest — Admin account management + notification read state (Aug 21, NOT pushed)

- **Per-notification mark-as-read:** `NotificationCenter` no longer auto-marks
  all unread on open. Each row now has a "Mark read" button and the dropdown
  header has an explicit "Mark all read" action; the unread badge decrements as
  items are read individually.
- **OAuth toggles are audit logged:** `POST /api/internal/admin/oauth-provider`
  now calls `logAdminAction({ actionType: "toggle_oauth_provider", ... })`.
- **Admin account management (migration 048, APPLIED):**
  - Added `payouts_paused_at` / `payouts_paused_by` to both `creator_profiles`
    and `business_profiles`.
  - Expanded `admin_audit_logs.action_type` CHECK to add `toggle_oauth_provider`,
    `cancel_plan`, `terminate_account`, `pause_payments`, `resume_payments`.
  - Rewrote `POST /api/internal/admin/users` with new actions:
    `cancel_plan` (sub → canceled), `terminate` (cancel plan + ban + pause
    payouts), `pause_payments` / `resume_payments` (set/clear the flag). All
    audit logged + user-notified.
  - `AdminUserActions` + `/admin/users` now show plan + payments-paused state
    and expose the new buttons.
  - **Money-movement guards:** `processWeeklyPayouts` and `releaseConversion`
    skip creators whose payouts are paused (hold still releases, transfer is
    withheld); `createDestinationChargeForConversion` refuses to charge a
    business whose payments are paused.
- **Verified:** typecheck ✓ · lint 0 errors · 184 tests · build ✓.
  Migration 048 APPLIED. **NOT pushed.**

---

## Latest — Admin Google enable flow + notification bell confirm (Aug 21, NOT pushed)

- **Google OAuth admin enable flow:** Google is now a runtime feature flag
  (`app_settings.google_oauth_enabled`, seeded by migration **047**, APPLIED).
  New shared `GoogleAuthButton` component renders the real button when the flag
  is "true", otherwise the blurred "Coming soon" tile. Login + signup both use
  it (the old inline blurred blocks were replaced).
- **Superadmin control:** new `POST/GET /api/internal/admin/oauth-provider`
  (admin-gated via `app_metadata.role === "admin"`) toggles the flag through the
  service role. `OAuthProviderToggle` client component added to the Superadmin
  dashboard (`/admin`, under a new "OAuth providers" section). Flip it to Enable
  only AFTER the Google Cloud redirect URI is registered.
- **Notification bell confirmed already present:** the dashboard header bell
  (`NotificationCenter` in `dashboard-shell.tsx`) already surfaces the team
  accept/decline rows (type `system`, unread badge, link to
  `/dashboard/business/profile`). Verified earlier via `scripts/team-notify-check.mjs`
  (3/3). No new code was needed — the notifyOwner insert and the bell were both
  already wired.
- **Verified:** typecheck ✓ · lint 0 errors · 184 tests · build ✓.
  Migration 047 APPLIED. **NOT pushed.**

---

## Latest — Team invite email, owner notify, password flow, Google blur (Aug 21, NOT pushed)

- **Owner notification:** team route PATCH (accept/decline) now inserts a
  `notifications` row (type `system`) for the owner — "<email> accepted/declined
  your team invitation" — via a new `notifyOwner()` helper. **Verified live**
  (`scripts/team-notify-check.mjs`, 3/3): invite 201 → member accepts → owner's
  notifications table shows the accept row.
- **Invitee password flow:** brand-new invitees are now created with
  `email_confirm:false` and get a Supabase `admin.generateLink({ type: "invite" })`
  link embedded in the branded email, so they can set a password and confirm in
  one step. Existing-user invites keep a password-set link via `type: "recovery"`.
  Team E2E re-run **10/10** (`scripts/team-e2e.mjs`) with the new flow.
- **Google sign-in blurred → Coming soon** on both login and signup (matches the
  existing blurred-Microsoft pattern) — the handler is now disabled/not-reached.
- **New guide `SOCIAL_KEYS_SETUP.md`:** step-by-step for creating TikTok client
  key/secret + Instagram (Meta) client ID/secret and pasting them here, since
  those four env vars are still EMPTY.
- **Verified:** typecheck ✓ · lint 0 errors · 184 tests · build ✓.
  **NOT pushed.**

---

## Latest — Single-session enforcement, dark-mode leak fix (Aug 21, NOT pushed)

- **Single-session enforcement:** every login (password, OTP, OAuth callback, TOTP-login, QR-signup) stamps a random `active_session` id in `user_metadata` and a matching `adswish-session-id` cookie. Middleware compares the two on every protected request — if they differ, a newer login superseded this one and the user is sent to `/session-expired` (masked email + Contact Support button + Sign Out). Works across devices, tabs, and browsers.
- **Dark-mode leak fixed:** `ThemeProvider` now only applies saved appearance on dashboard pages (`/dashboard/*`, `/onboarding/*`, `/admin/*`). Public pages always render in the default light theme. `resetAppearance()` called on both logout paths (manual + back-button).
- **Fixed a bug in `handleSubmit` (login):** `establishSessionClient` was called before the Supabase client was created — moved it after `setSession`.
- **All changes NOT pushed** — waiting for your go-ahead.

---

## Team invite email + env sync (Aug 21, NOT pushed)

- **Team-invite email:** the team invite route now sends a branded Resend email
  ("X invited you to their Adswish team") via `sendEmail` + the new
  `teamInviteEmailHtml`. Failure is non-fatal — the pending invite still shows
  in the dashboard even if Resend is unreachable.
- **Team E2E verified 9/9** (`scripts/team-e2e.mjs`): throwaway owner+invitee
  (no 2FA so the middleware MFA gate does not redirect) → invite 201 → pending
  row (joined_at null) → accept → joined_at set → revoke → row removed.
  **Note:** the invitee is created with `email_confirm:true` and NO password —
  they must set one (or use a one-time code) before password login. The accept
  flow works regardless via the pending-invite banner.
- **Env sync:** `scripts/sync-env.mjs` copied 7 runtime keys from `.env.local`
  into `vercel-env.txt` (JWT_SIGNING_SECRET, MESSAGE_ENCRYPTION_KEY,
  NEXT_PUBLIC_APP_DOMAIN, SUPABASE_JWKS_URL, GOOGLE_OAUTH_*). vercel-env.txt now
  has 30 entries. Skips management keys (SUPABASE_ACCESS_TOKEN, VERCEL_OIDC_TOKEN).
- **Still EMPTY (need you to paste values):** TIKTOK_CLIENT_KEY/SECRET,
  INSTAGRAM_CLIENT_ID/SECRET, CLOUDMERSIVE_API_KEY, AWS_REKOGNITION_*,
  STRIPE_TAX_API_KEY, STRIPE_WEBHOOK_SECRET_STAGING, PostHog/Sentry (optional).
- **Verified:** typecheck ✓ · lint 0 errors · 184 tests · build ✓.
  **NOT pushed.**

---

## Follower re-check, team seats, asset upload UI (Aug 21, NOT pushed)

- **Campaign asset upload UI:** new `CampaignAssetUpload` component + `uploadCampaignAsset()`
  helper; wired into `/dashboard/business/campaigns/new` (file picker → preview →
  uploaded to `/api/internal/campaigns/[id]/asset` after the campaign row is created).
- **Follower re-check worker (gap 1):** new `src/lib/follower-recheck.ts` with
  `recheckFollowerCounts()` + `tierForFollowers()`. Re-fetches TikTok/Instagram/YouTube
  live counts, stamps `creator_social_accounts`, recomputes tier (micro/mid/macro from
  max connected count) + refreshes badges. **Graceful:** a platform whose keys are
  empty (TikTok/Instagram currently are) is skipped, never an error. Cron route gains
  `follower-recheck` job; migration **046** replaced the `SELECT 1` stub with an
  HTTP dispatch (1st of month 00:00). 4 unit tests added.
- **Team seats lifecycle (gap 7):** rewrote `/api/internal/team` for the full
  invite → accept/decline → revoke flow with plan seat-limit enforcement
  (Growth 2 / Enterprise 5 / Free 1 via `subscription_plans.features.team_seats`).
  New `TeamManagement` client component (invite form, pending-invite accept/decline,
  remove buttons) wired into `/dashboard/business/profile`. Dashboard redirect now
  routes team members (`app_metadata.business_id` without own profile) to the team
  profile page. No schema change needed (`business_team_members.joined_at` already
  exists; `null` = pending).
- **Verified:** typecheck ✓ · lint 0 errors · 184 tests · build ✓.
  Migration 046 APPLIED. **NOT pushed.**

---

## Blueprint gap closures + UptimeRobot (Aug 21, NOT pushed)

- **UptimeRobot wired:** read-only key `ur3724…` added to `.env.local` +
  `vercel-env.txt` as `UPTIME_ROBOT_API_KEY` (verified live: 1 monitor,
  adswish-lake.vercel.app, status up). The monitor-specific key `m80…` is NOT
  usable by the `getMonitors` endpoint the tracking route calls.
- **Partition maintenance (gap 2):** migration **042** adds
  `adswish_ensure_monthly_partitions(months_ahead)` (dynamic SQL, idempotent via
  to_regclass) and replaces the `create-clicks-partition-monthly` stub with the
  real call on the 25th. APPLIED; verified 6 partitions exist, cron active.
- **Account deletion (gap 6):** migrations **043** (nullable review FKs +
  `deletion_requests` audit table, deny-all RLS) + **044** (review FKs →
  ON DELETE SET NULL) APPLIED. New `POST /api/internal/account/delete` blocks
  creators with pending_hold conversions and businesses with balance_cents > 0,
  GDPR-anonymises reviews (reviewer_id/reviewee_id → NULL, written_feedback → NULL),
  records `deletion_requests`, then hard-deletes the auth user. Settings page
  gains a Danger zone card (type-DELETE confirmation) + login `?deleted=1` banner.
- **Cursor pagination (gap 8):** new `src/lib/pagination.ts` (encode/decode/parse/
  nextCursor, base64url keyset) + 9 unit tests. Creator campaign discover endpoint
  now accepts `cursor` + `limit` and returns `next_cursor`.
- **Campaign assets (gap 3):** migration **045** (public `campaign-assets` bucket +
  `campaigns.asset_url`) APPLIED. New `POST /api/internal/campaigns/[id]/asset`
  (owner-scoped, 25MB, image/video allowlist, orphan cleanup).
- **Verified:** typecheck ✓ · lint 0 errors · 180 tests · build ✓.
  **NOT pushed.**

---

## Email/Resend status (Aug 21)

- Resend now requires **only the DKIM record** to verify a domain (confirmed in
  the Resend dashboard — the user sees exactly one record: TXT `resend._domainkey`).
  MX/SPF/CNAME are optional extras (bounce handling), NOT required to send.
- **Blocker 1: DKIM record not yet published** — `dig TXT resend._domainkey.adswish.com`
  returns nothing. User must add the TXT record at their DNS provider (value is in
  the Resend dashboard, domain id `a9e3bf44-c5b0-4d91-8e36-e53872e19e61`).
- **Blocker 2: RESEND_API_KEY in `.env.local` is a placeholder** — the file comment
  says "NOT YET SET" and the Resend API rejects it (HTTP 400). User must create a
  fresh key at resend.com → API Keys and paste it into `.env.local` + `vercel-env.txt`.
  (The old key was rotated — the current value is dead.)
- Added `NEXT_PUBLIC_APP_URL` to both env files: dev = `http://localhost:3000`,
  prod (vercel-env.txt) = `https://adswish-lake.vercel.app` (update when a custom
  domain is connected).
- New helper: `node scripts/email-setup.mjs [recipient@example.com]` — validates the
  key, lists domains + DNS status, and sends a test email once the domain is verified.

---

## Previous — TOTP 2FA, Apple removed, Resend key rotated, landing integrations (Aug 20, NOT pushed)

- **TOTP two-factor authentication (built + E2E-proven):**
  - Settings → Security & 2FA (`/dashboard/settings/security`, server page with
    role detection + `SecuritySettings` client component): enroll (QR + secret),
    verify to activate, disable. Linked from the Settings index (new card).
  - Login flow enforces 2FA **at the app level** (works regardless of the
    project's MFA mode — this instance is "Optional", so GoTrue's password
    grant returns 200 + AAL1 session instead of `mfa_verification_required`):
    - `probeClient()` = `createClient(..., { auth: { persistSession: false } })`
      so NO session is persisted before 2FA completes (closes the AAL1-leak gap).
    - After password/OTP success, checks `data.user.factors` for a verified
      factor → shows the 6-digit code step → challenge/verify → `setSession`
      with the AAL2 tokens on the main (cookie-persisting) client.
    - The `mfa_verification_required` error branch is still handled for
      projects that enforce server-side.
  - **2FA at sign-up:** brand-new accounts (email/password confirmation,
    one-time code, or first Google sign-in) pass through an **optional**
    `/setup-mfa` step before onboarding — QR code + manual secret +
    verify a real code to enable 2FA immediately; fully skippable, and the
    page auto-redirects anyone with a verified factor straight to `next`.
    Wired via the fresh-account branch (`created_at` < 15 min) in
    `/auth/callback` + the signup page's OTP path.
  - **FIXED a 404 in the 2FA gate:** the middleware redirected users with a
    verified factor to `/auth/mfa`, but the (auth) route group renders at the
    root — the real page is `/mfa`, so Google/OTP users landing on a protected
    route at AAL1 hit a 404 instead of the authenticator screen. Now `/mfa`.
  - **FIXED a build-breaking PDF bug:** the changelog PDF route embedded
    pdf-lib's WinAnsi-only Helvetica font and `widthOfTextAtSize` threw on the
    "→" in changelog copy (build failed at /legal/changelog/pdf). Added
    `toPdfSafe()` to replace/drop non-WinAnsi characters before measuring and
    drawing.
- **Spec §22–24 (creator profile, friends, badges) — built (Aug 20):**
  - Profile header now shows @handle (primary social) + rating count; reviews
    enriched with the reviewer's business name + campaign title + relative
    time (read via service role — `reviews` has no public-read RLS policy,
    same pattern as the portfolio query).
  - New public **Campaign History** section: accepted applications joined to
    campaigns + business names (service role), Completed/Active/Ended badges.
  - `ConnectButton` friends state now matches spec: green **Added** + **Copy
    Username** (clipboard, @handle) + **Message** (role-aware link to the
    viewer's Messages hub); @handle shows beside Add Friend.
  - Badges tightened to spec §24: blue = paid plan AND ≥1 verified social;
    gold = **Premium** plan AND ≥1M followers. Identity (ID upload) check is
    NOT wired — needs the ID-upload + admin-review flow (documented gap).
  - Website URL field: not in schema (no `website_url` column) — skipped,
    documented.
  - Verified: typecheck ✓ · lint 0 errors ✓ · 165 tests ✓ · build ✓.
- **QR-code auth fallback (no email needed) — built (Aug 20):**
  - When the confirmation/OTP email doesn't arrive, users can now sign up or
    log in with an authenticator app: the app shows a QR code (otpauth URI,
    rendered with the new `qrcode` dep), the user scans it with Google/Microsoft
    Authenticator/Authy/1Password and enters the 6-digit code.
  - `src/lib/totp.ts`: RFC 6238 (HMAC-SHA1, 30s, 6 digits, ±1 window) + base32
    + `otpauthUri` — pure, unit-tested against the RFC test vectors (7 tests).
  - Migration **040 APPLIED** (cloud): `totp_credentials` (user's secret,
    deny-all, service-role only) + `totp_pending` (half-finished signups,
    15-min expiry). New reusable `scripts/apply-migration.mjs` (Management API).
  - Routes: `POST /api/internal/auth/qr-signup` (start → secret+QR, complete →
    verifies code, creates the Supabase account + profile rows, stores the
    secret, issues a session) and `POST /api/internal/auth/totp-login` (email +
    code → session). Session issuance = admin password reset + `signInWithPassword`
    on a non-persisting client (no email, no PKCE). Both rate-limited via Upstash.
  - UI: /signup gets "Email not arriving? Sign up with your authenticator app"
    (QR + secret + code); /login gets "Log in with your authenticator app"
    (email + code). NOTE: authenticator-signup users log in ONLY via this path
    (they have no known password) — password login will fail for them by design.
  - E2E-proven: `scripts/qr-fallback-e2e.mjs` — start → real TOTP code →
    complete (session issued) → totp-login with a fresh code → getUser matches;
    throwaway user deleted afterwards.
  - Verified: typecheck ✓ · lint 0 errors ✓ · 172 tests ✓ · build ✓.
- **Business-side profiles (spec §22) + hover tooltips (§21) — built (Aug 20):**
  - Migration **041 APPLIED** (cloud): `business_profiles.verified_badge` +
    `gold_badge` (blue = Growth/Enterprise + verified_domain; gold =
    Enterprise + kyb verified). `badges.ts` gained `refreshBusinessBadges` /
    `refreshAllBusinessBadges`; the cron `badges` job now sweeps creators +
    businesses.
  - `/businesses/[id]` rebuilt to mirror the creator page: header badges +
    verified-domain line + rating with review count, **Connected channels**
    (website card, ✅ Active), **Recent reviews** (reviewer creator name +
    campaign + relative time, service-role enriched), **Campaign history**
    (real non-draft campaigns with Completed/Active/Ended badges), and
    `ConnectButton` stays. OG metadata added.
  - `/businesses` grid + `BusinessGrid` cards now show Verified/Gold pills.
  - **§21 tooltips:** new `InfoTooltip` + `SectionLabel` (ℹ️ icon → dark
    tooltip with white text above on hover) on both profile pages' sections
    (Niches, Connected accounts, Portfolio, Reviews, Campaign history).
  - Verified: typecheck ✓ · lint 0 errors ✓ · 172 tests ✓ · build ✓.
  - **Proven** via `scripts/mfa-e2e-test.mjs` (safe, self-cleaning): real
    user → enroll → **real generated TOTP code** → verify (AAL2) → login gate
    detects factor → challenge + fresh code → AAL2 tokens. All green; user
    deleted afterwards. MFA REST paths (this GoTrue version):
    `POST /auth/v1/factors`, `POST /factors/{id}/challenge`,
    `POST /factors/{id}/verify`, `DELETE /factors/{id}` (no challengeId on
    unenroll in this SDK).
- **Apple sign-in REMOVED** from login + signup (user hasn't set it up).
  Microsoft (Azure) button remains with the "not enabled yet" hint.
- **Resend API key ROTATED** (the old one had appeared in a tool transcript):
  new sending-only key (`sending_access`) created, written to `.env.local`,
  pushed into Supabase SMTP (smtp_user + smtp_pass) — **and the full SMTP
  block re-applied because a partial PATCH wipes host/port**. Old leaked key
  + 2 orphaned keys deleted. Remaining: "Onboarding" (unused, left alone) +
  the new key.
- **Landing page**: new Integrations section (after the deep-dives, before
  the Chrome extension) — all 14 brand logos in dashboard-style muted tiles,
  verified rendering (14 SVGs + names).
- **Verified:** typecheck ✓ · lint 0 errors ✓ · 165 tests ✓ · build ✓ ·
  `/login` shows Microsoft only ✓ · changelog v3.3.0 live ✓. **NOT pushed.**

---

## Previous — Integration hub v2 (logos + add/remove), Microsoft sign-in, Resend SMTP (Aug 20, NOT pushed)

- **Integration hub rebuilt** (`src/components/dashboard/integration-hub.tsx`):
  - Real brand logos (simple-icons paths inlined in `integration-logos.tsx`,
    rendered `currentColor`; LinkedIn hand-drawn, Sightengine generic
    shield-check mark since simple-icons lacks both).
  - State machine replaces "Coming soon / Notify me": green **Add** →
    green **Added** pill (card tinted) + red **Remove** button.
  - Persisted per user via `user_integrations` (migration **039 APPLIED**, RLS
    owner-only) + `GET/POST/DELETE /api/internal/integrations`; plan limit
    enforced server-side (critical 5 always count; `integrationLimitForPlan`
    unchanged: free 6 / tier-2 10 / tier-3 20).
  - E2E-verified in preview: Add → 6/6 + "Added"/"Remove"; Remove → 5/6 +
    "Not connected"/"Add".
- **Microsoft + Apple sign-in** (`src/components/ui/oauth-icons.tsx`): buttons
  on `/login` + `/signup` calling `signInWithOAuth(provider: azure|apple)`;
  graceful "provider not enabled" message until admin configures them in
  Supabase Auth (no Azure/Apple keys exist yet — external_azure_enabled=false).
- **Resend custom SMTP CONFIGURED in Supabase** (config/auth PATCH):
  `smtp_host=smtp.resend.com`, `smtp_port=465`, user/pass = RESEND_API_KEY,
  sender `Adswish <onboarding@adswish.com>`. Rate limits raised:
  `rate_limit_email_sent` 2 → **30**, `rate_limit_otp` = 30.
  **⚠️ Emails pause until the user adds the Resend DNS records** (domain
  `adswish.com` added to Resend: DKIM TXT `resend._domainkey`, MX `send` →
  `feedback-smtp.us-east-1.amazonses.com`, SPF TXT `send`). Records in
  Resend dashboard / domain id `a9e3bf44-c5b0-4d91-8e36-e53872e19e61`.
  ⚠️ RESEND_API_KEY value appeared in one tool output — recommend rotation.
- **Verified:** typecheck ✓ · lint 0 errors ✓ · 165 tests ✓ · build ✓ ·
  migration 039 applied ✓ · `/login` + `/signup` SSR include Microsoft/Apple ✓ ·
  integrations page live with logos + working Add/Remove ✓. **NOT pushed.**

---

## Previous — Google Ads Phase 4 + Supabase email config (Aug 20, NOT pushed)

- **Supabase auth config FIXED via Management API (PATCH config/auth):**
  - `site_url` was the stale `https://adswish-atlas-5563.vercel.app/` → now
    `https://adswish-lake.vercel.app/` (the live domain).
  - `uri_allow_list` only had `http://localhost:3000/auth/callback` (no wildcard) —
    every redirect with query params (Google OAuth `?next=/onboarding&role=…`,
    password reset `?next=/update-password`) was REJECTED. Now includes
    `http://localhost:3000/**` + `https://adswish-lake.vercel.app/**` + the exact
    callback paths. This was the root cause of the sign-in/verify failures.
  - `mailer_otp_length` 8 → 6 (matches the UI). Email templates were already
    correct (`{{ .ConfirmationURL }}`); SMTP unset (Supabase email).
- **PKCE cross-browser fix:** signup/OTP/reset now embed `?email=…` in
  `emailRedirectTo`; `/auth/callback` catches the "PKCE code verifier not found"
  failure on confirmation links and verifies the account server-side (service
  role, `auth.users` lookup + `email_confirm: true`), redirecting to
  `/login?confirmed=1`. Recovery links (`next=/update-password`) keep the error
  path. Login page shows a green "email verified" banner.
- **Google Ads Phase 4 (migration 038 APPLIED):**
  - `deliverable_ab_assets` (3 variants/deliverable, RLS owner) +
    `google_ads_partner_credits` (not_applied/applied/approved/declined) +
    `google_ads_campaigns.ab_asset_id`.
  - `src/lib/google-ads/thumbnails.ts`: ffmpeg-static (installed, binary present)
    extracts frames at 10/50/90% duration → public `google-ads-assets` bucket
    (created on demand); graceful `failed` rows when ffmpeg/video unavailable.
  - Routes: `GET/POST /api/internal/google-ads/thumbnails`, `…/[id]/select`,
    `GET/POST /api/internal/google-ads/partner-credits`. All 401 unauth ✓.
  - Job `google-ads-thumbnails` wired into the cron route (auto-generates for
    approved deliverables without assets).
  - Analytics route now returns `organic` (30-day conversions/revenue/daily via
    the user's campaigns → tracking links → conversions) + `blended` totals;
    `GoogleAdsAnalytics` rebuilt with revenue-by-source pie + organic 30-day
    series + blended ROAS cards.
  - Dashboard: `GoogleAdsAbAssets` + `GoogleAdsPartnerCredits` mounted between
    analytics and the kill switch.
- **Verified:** typecheck ✓ · lint 0 errors ✓ · **165/165 tests** ✓ · build ✓ ·
  migration applied (tables 200 via service-role REST) · routes 401 unauth ✓ ·
  `/login?confirmed=1` banner renders ✓. **NOT pushed.**
- **E2E-proven after this entry (same session):**
  - Email flow: real confirmation link followed with NO cookies → email
    auto-confirmed (both the implicit path and the PKCE branch, which now uses
    `auth.admin.listUsers` — `auth.users` is NOT exposed to PostgREST, 406) →
    password login SUCCESS.
  - A/B thumbnails: real ffmpeg-generated MP4 uploaded → approved
    (`completed` status) deliverable → 3 JPEG frames extracted (10/50/90%),
    stored in `google-ads-assets`, all HTTP 200. **Two bugs fixed during E2E:**
    (1) deliverable status filter used `approved` but approval stamps
    `completed` (thumbnails route + job); (2) `next dev` rewrites the
    ffmpeg-static path to a virtual `/ROOT/…` — lib now falls back to the real
    node_modules path. Also raised `mailer_otp_length` to 6; `rate_limit_email_sent`
    (2) can't be raised without custom SMTP — fine for production (per-address
    limit). All test users/campaigns/assets cleaned up.

## LIVE STRIPE KEYS — Aug 18 2026

- `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env.local` and `vercel-env.txt` are now the **live** (`sk_live_`/`pk_live_`) keys, verified against the Stripe API.
- ⚠️ Live account settles in **GBP** (not USD). Added `STRIPE_CURRENCY=gbp` to both files; all Stripe calls (charges, transfers, v2 account creation, campaign currency) now read `getStripeCurrency()` (default `usd`). Commit `21292e2` pushed.
- ⚠️ **Never run the E2E/probe scripts (`scripts/stripe-*.mjs`) while live keys are in `.env.local`** — they charge/move real money. Use them only in test mode.
- TODO for Vercel: add `STRIPE_CURRENCY=gbp` + the live keys to the project env vars (they are gitignored, so push does not carry them).

> Read this first. This is a living handoff file — updated as work progresses.
> Master source of truth for scope: `ADSWISH_MASTER_BLUEPRINT_v4.md`.
> **All agents: read `AGENTS.md` FIRST** — it has the mandatory safety rules (live Stripe
> keys!, do/don't list, verification gate, migration process).

## Latest — Marketing/tier/onboarding batch (Aug 19, NOT pushed)

- **Landing page:** “Adswish 2.0 is live” badge; headline → “A marketplace for
  business and creators”; added **Businesses** + **Plans** nav links; pixel-promo
  buttons now actually work (Copy snippet → clipboard, GTM → `/adswish-gtm-tag.html`,
  Chrome extension → `#extension`).
- **New pages:** `/plans` (business + creator plans with real limits), `/businesses`
  (business marketplace: features grid + searchable directory).
- **Tier rename:** shared `TIER_META` in `src/lib/tier.ts` — Small Creator (emerald) /
  Moderate Creator (blue) / Big Creator (violet), applied across landing, grid,
  `[id]`, onboarding, dashboards, guides. Underlying enum values (`micro/mid/macro`)
  unchanged — no DB change.
- **Signup:** Google sign-in now **requires** the ToS + privacy tick-boxes (was only
  role-checked).
- **Leave-site popup:** `logout-button.tsx` now shows a “You're leaving Adswish”
  Proceed/Back modal + a `beforeunload` guard for closing the tab.
- **Profile pages:** “next phase” plan banner → “View plans” link to `/plans`.
- **Avatar upload:** new `POST /api/internal/profile/avatar` (5MB PNG/JPEG/WebP/GIF →
  public `profile-images` bucket; stamps `creator_profiles.profile_picture_url` or
  `business_profiles.logo_url`) + `AvatarUpload` client component wired into both
  profile pages. **Migration 024 (bucket) NOT applied yet.**
- **Paid plans → Stripe:** new `POST /api/internal/stripe/subscribe` (Checkout mode
  subscription, inline price, metadata user_id/role/plan_slug) + both onboarding
  `plan_selection` pages redirect to Stripe for paid plans. `syncSubscription` now
  upserts on the owner column. **Migration 025 (unique owner index) NOT applied yet.**
- **Chrome extension:** popup now has a **green/red status dot** (live heartbeat check);
  generated brand-blue PNG icons (16/48/128) + manifest `icons`/`default_icon`;
  re-zipped as `chrome-extension/adswish-tracker-v1.2.0.zip` (Web-Store-ready).
- **Verified:** typecheck clean · lint 0 errors (5 pre-existing warnings) ·
  **162/162 tests** · build passes (new `/plans` + `/businesses` static pages).
- **NOT deployed.** Full user action-item guide: `WILL_ACTION_ITEMS.md`.

## Latest — Balance + analytics + limits + tracking + Google fix (Aug 19, NOT pushed)

- **Migrations 024–027 APPLIED to cloud:** profile-images bucket, subscription
  unique owner index, `business_profiles.balance_cents` + `balance_transactions` +
  `cashout_requests` (RLS owner-read), campaigns `hashtags`/`media_url`/
  `manual_review` + `status` now allows `closed`.
- **Balance system:** `src/lib/balance.ts` (credit/debit ledger, 90/10 cash-out
  split, £10 min). `POST /api/internal/balance/topup` (Stripe one-time Checkout),
  `GET/POST /api/internal/balance` (balance + transactions + cash-out request),
  webhook `checkout.session.completed` credits `metadata.kind="topup"`. Balance
  widget on `/dashboard/business/payments`.
- **Fixed-accept balance check:** accepting a creator on a `fixed` campaign now
  debits `fixed_amount` from the business balance; insufficient → campaign set
  `closed`, all applicants + business notified, business emailed. Acceptance now
  also emails the creator (Resend REST helper in `src/lib/email.ts`, no SDK).
- **Business plan limits:** `BUSINESS_PLAN_CAMPAIGN_LIMITS` free 3 / growth 20 /
  enterprise ∞ enforced in `POST /api/internal/campaigns`.
- **Analytics:** new `/dashboard/creator/analytics` + `/dashboard/business/analytics`
  (clicks/conversions/gross/90-10 from `daily_conversion_rollups`) + nav items.
- **Google sign-in persistence FIX:** `/auth/callback` no longer resets
  `onboarding_step` on every OAuth sign-in (was forcing users back through
  onboarding).
- **Appearance settings:** `ThemeProvider` + `src/lib/appearance.ts` + Settings
  “Appearance” card — dark/light/system, font-size (sm/md/lg), accent colour
  (blue/violet/emerald/rose/slate). CSS hooks in `globals.css`.
- **Campaign creation:** new-campaign form now has per-platform hashtags
  (TikTok/Instagram/YouTube), preview media URL, and a manual-review checkbox.
- **Two-layer tracking:** `GET /api/internal/tracking/status` + `TrackingStatus`
  UI on the tracking page — in-house pixel/link check + external verified-domain
  reachability check, two green/red ticks.
- **Legal:** Terms/Privacy/Subprocessors refreshed (balance + cash-out + tracking
  sections; removed stale Inngest/Sentry subprocessors).
- **Verified:** typecheck clean · lint 0 errors (5 pre-existing warnings) ·
  **162/162 tests** · build passes. Dev server running on :3000 (detached via
  `scripts/dev-server.mjs`). **NOT deployed to Vercel.**

## Latest — Connections + gating + cash-out + chat fix (Aug 19, NOT pushed)

- **Migrations 028–029 APPLIED:** `connections` (friend requests, RLS) +
  `campaign_invites` (business→creator invites, RLS); business_profiles now has
  `stripe_account_id`/`stripe_connect_ready` for cash-outs.
- **CHAT BUG FIXED:** `campaign-messages.tsx` selected `campaigns.name` but the
  column is `title` → the messages page always returned empty. Fixed to `title`
  (+ valid status list). This was why accepted users couldn't message.
- **Connections/friends:** `GET/POST/PATCH /api/internal/connections`,
  `GET /api/internal/users/search`, `GET/POST/PATCH /api/internal/campaign-invites`;
  `ConnectButton` on public creator/business profiles; `ConnectionsPanel` on both
  Messages pages (Add/search, friends A–Z, accept/reject requests, business
  “Invite to campaign”).
- **Campaign gating:** affiliate/hybrid now require Stripe payment method +
  active tracking/verified domain; fixed campaigns require tracking OR sufficient
  wallet balance at creation (enforced in `POST /api/internal/campaigns`).
- **Cash-out wiring:** `/api/internal/stripe/connect-link` now supports business
  Connect onboarding; `POST /api/internal/balance` attempts a Stripe transfer to
  the business Connect account when ready, refunds the balance + marks failed on
  transfer error. Real payouts still need the business to complete Connect
  onboarding + the platform Connect profile (same human step as creators).
- **Appearance:** added background (plain/gradient/grid) + content layout
  (standard/wide) to the Appearance settings.
- **Global back button** added to the dashboard top bar (`BackButton`).
- **Verified:** typecheck clean · lint 0 errors (6 pre-existing warnings) ·
  **162/162 tests** · build passes. **NOT deployed to Vercel.**

## Latest — Invite auto-apply + chat presence + Stripe status (Aug 19, NOT pushed)

- **Invite accept → auto-apply:** `PATCH /api/internal/campaign-invites` now
  creates a `pending` application (with `tier_at_application`) and notifies the
  business when a creator accepts an invite.
- **Chat presence + typing:** `CampaignChat` added a second realtime channel
  (`chat-social-*`) with Supabase presence (online count) + typing broadcasts.
- **Connections/invite E2E verified 8/8** (`scripts/connections-e2e.mjs`):
  friend request → accept → friends list → campaign invite → accept → auto-apply.
  Fixtures cleaned up.
- **Stripe platform account checked (read-only):** `acct_1U5S3OLKYp5LxY80` is
  **fully onboarded** — charges/payouts enabled, details_submitted, `transfers`
  capability **active**, nothing currently_due. The old “platform questionnaire”
  blocker is GONE. Payouts/cash-outs now only need each connected account
  (creator/business) to finish its own onboarding in-app.
- **Verified:** typecheck clean · lint 0 errors · 162/162 tests · build passes.

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

## Latest — Marketplace filters + full conversion E2E (Aug 19, NOT pushed)

- **Marketplace filters added to /creators** (`CreatorGrid` client component):
  free-text search (name/niche/handle), tier filter (all/micro/mid/macro),
  sort (rating / followers / A–Z), and clickable niche chips.
- **Full conversion E2E verified live — 14/14** (`scripts/conversion-e2e.mjs`):
  business creates affiliate campaign → creator applies → business accepts
  (deliverable slots created) → creator submits → business approves (REAL
  tracking link generated) → GET /t/{slug} 302s with signed `adswish_ref` JWT
  → conversion webhook → conversion row `pending_hold`, 90/10 split
  (89.99/10 on a £99.99 order), 7-day hold, linked to the tracking link.
  All fixtures + tier change cleaned up.
- **TWO RLS bugs found + fixed (migration 023, applied live):**
  - `tracking_links` had NO INSERT policy → approve silently never created
    links (handoff's earlier "done" claim was wrong).
  - `deliverables` had NO INSERT policy → accept silently never created slots.
  Both now allow the business owner on their own campaigns.
- **Config gap fixed:** tracking-link destination fell back to the dead
  `https://adswish.com`; approve route now falls back to
  `https://adswish-lake.vercel.app`, and NEXT_PUBLIC_APP_DOMAIN was
  localhost:3000 locally (fixed in .env.local + vercel-env.txt). **Note:** the
  Vercel env var still needs adding (deploy-time).
- Pending local commits (NOT pushed): cf97f0d, 6799ee4 + this batch.

## Earlier — Creator marketplace grid + Chrome extension audit (Aug 19, NOT pushed)

- **New public creator marketplace grid at `/creators`** (landing nav link
  added): discoverable creators with tier badge, niche chips, average rating,
  total followers, and green Verified badges with platform icons (YouTube/
  Instagram/TikTok) per connected account. Cards link to each creator profile.
  Filter: only shows creators with rating > 0 or at least one verified social.
- **Chrome extension audit (works):**
  - Settings → Tracking & Attribution card → tracking page has the extension
    section with step-by-step install steps + the real API base + business ID.
  - Live-verified: `POST /api/v1/pixel/ping` → 200 (heartbeat), CORS
    OPTIONS → 204 with `*` (works from any business domain), conversion
    webhook rejects bogus tokens (security fine), `/t/{slug}` → 410 for
    unknown slugs.
  - Tracking-method toggle (pixel script vs extension) live-tested → persists
    to DB (`tracking_method`), restored afterward.
  - **FIXED:** extension `background.js` default `apiBase` was the dead
    `https://adswish.com` placeholder — now `https://adswish-lake.vercel.app`
    so the extension works out of the box (options still allow override).
  - What the extension needs to fire a conversion: a real tracking link
    (`/t/{slug}`) from campaign approval + the token in the URL/cookie +
    businessId configured in options. Auto-detect mode needs URL pattern +
    amount selector in options.
- Pending local commits (not pushed): `cf97f0d` (token refresh fix, IG
  long-lived tokens, cron wiring, verified badges) + this batch.

## Earlier — Social connect on creator profile + YouTube OAuth + sandbox check (Aug 19)

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

## Batch: dashboards, emails, third-party uptime, back button (Aug 19)

- **Sightengine moderation keys** written to `.env.local` + `vercel-env.txt` (user-provided
  API user `522078350` + secret; values not logged). `SIGHTENGINE_API_USER`/`SIGHTENGINE_API_KEY`
  are what `src/lib/moderation.ts` reads, so moderation is now enabled locally; paste
  `vercel-env.txt` into Vercel for prod.
- **Global back button** — `src/components/global-back-button.tsx` (fixed floating "Back",
  always rendered, calls `router.back()`) mounted in root layout, so it's on every page.
- **Site-wide external-link guard** — `src/components/external-link-guard.tsx` (capture-phase
  click interceptor, "You're leaving Adswish" Proceed/Back modal) mounted in root layout.
- **Business dashboard rebuilt** — `dashboard/business/page.tsx` now shows real campaign list,
  recent applicants, active-campaign count, pending-applicant count, and wallet balance with
  a top-up link (no more static zeros).
- **Styled HTML emails** — `src/lib/email.ts` branded wrapper + `acceptedEmailHtml` /
  `campaignClosedEmailHtml`; applications route now sends HTML + text.
- **Third-party uptime layer** — `tracking/status/route.ts` gained an optional
  `uptimeRobotCheck()` driven by `UPTIME_ROBOT_API_KEY`; `TrackingStatus` renders a third
  row ("Third-party uptime check"). Only gates `fully_active` when the key is configured.
- Verification: typecheck clean · lint 0 errors (6 pre-existing warnings) · 162/162 tests · build passes.
- Still not deployed. Docs updated: `WILL_ACTION_ITEMS.md`, `GO_LIVE_CHECKLIST.md`.

## Batch: plan dashboard, tracking false-green fix, charts, uptime UI, chrome notice (Aug 19)

- **Plan dashboard** — new `dashboard/{business,creator}/plan` pages + `PlanDashboard` +
  `PlanUpgradeButton`; nav items "Plan" added under Messages on both sides. Shows current plan,
  status, next payment (`current_period_end`), usage vs limits, and upgrade cards (Stripe Checkout).
- **Tracking false-green fixed** — root cause: `hasLiveLink` counted ANY non-revoked tracking link,
  and a demo fixture (`scripts/demo-tracking-link.mjs`) left "Demo tracking link — try the extension"
  + 2 clicks. Deleted that demo campaign/link/clicks (`scripts/cleanup-demo-tracking.mjs`) and
  tightened the in-house check: now requires a live pixel heartbeat (last 24h) OR a tracking link
  that has actually received clicks. Migration **030** added a `clicks_log` SELECT policy (business
  owner + creator) so the status route can check link usage.
- **Analytics depth** — `AnalyticsCharts` (recharts) added to both analytics pages: daily
  clicks/conversions bar chart + gross-sales area chart; colours read live CSS vars so charts follow
  dark mode + accent choice.
- **Background themes fixed** — grid/gradient backgrounds were hidden behind opaque
  `min-h-screen bg-background` wrappers; removed that class from dashboard shell, plans page,
  auth/onboarding layouts, and guide pages so the body pattern shows through.
- **Uptime instructions** — Tracking page now has a step-by-step UptimeRobot setup block
  (create monitor → read-only API key → `UPTIME_ROBOT_API_KEY` env var → check again).
- **Chrome extension notice** — `ChromeExtensionNotice` warns non-Chrome browsers in the tracking
  page's extension section and links to download Chrome.
- Verification: typecheck clean · lint 0 errors (6 pre-existing warnings) · 162/162 tests · build passes.
- Not deployed. Preview at http://localhost:3000.

## Batch: plan-limit prompt, fake-account purge, analytics range switcher (Aug 19)

- **Plan limit enforcement** — server already blocked 3/20/unlimited active-campaign limits; the
  campaign form now surfaces a proper in-app "plan limit reached → Upgrade plan" banner (links to
  /dashboard/business/plan) instead of a raw `alert()`.
- **Fake accounts purged** — deleted businesses "sdadadad" (willgreer2025@) + "ddfsf"
  (willgreer38@), creators "davis" (wgreer301@) + "Sarah" (willgreer007@icloud), and orphan
  creator@test.com. DB now has zero business/creator profiles, campaigns, applications,
  tracking_links, clicks, connections. One orphan auth user left: `wilgreer38@gmail.com` (typo,
  no profile) — flagged, not deleted. Recreated two clean test accounts via
  `scripts/create-test-accounts.mjs` (business GreerCo / creator Will Greer).
- **Analytics time-range switcher** — AnalyticsCharts gained Today / 7 days / 30 days buttons
  (client-side date filter) on both analytics pages.
- **Browser-verified** — signed in as business (GreerCo) and creator (Will Greer) on localhost:
  both Plan pages render (current plan, next payment, usage, upgrade cards) and both dashboards
  load with the new surfaces; logout "You're leaving Adswish" modal confirmed working.
- Verification: typecheck clean · lint 0 errors (6 pre-existing warnings) · 162/162 tests · build passes.
- Not deployed. Preview at http://localhost:3000.

## Batch: creator plan limits, demo seed, test-mode webhook smoke test (Aug 19)

- **Orphan auth user deleted** — `wilgreer38@gmail.com` (typo, no profile) removed via Auth Admin API.
- **Creator plan limits enforced** — `CREATOR_PLAN_CAMPAIGN_LIMITS` (creator_free 2 / creator_pro 10 /
  creator_premium unlimited) added to `campaign-limits.ts`; the apply route now caps
  `maxActiveCampaigns = min(tierCap, planCap)` and returns an "Upgrade your plan" error; the
  discover page shows an in-app upgrade banner (links to /dashboard/creator/plan).
- **Demo data seeded** — `scripts/seed-demo-data.mjs` (idempotent) created 3 campaigns for GreerCo,
  applications (1 accepted), creator_social_accounts (25k/12.4k/48k followers), reviews, and 14 days
  of `daily_conversion_rollups` for Will Greer. Verified in-browser: creator analytics now shows
  2,233 clicks / 103 conversions / £6,329 gross with populated bar + area charts and the range switcher.
- **Test-mode webhook smoke test** — `scripts/webhook-smoke-test.mjs` verifies Sightengine moderation
  (real API call, HTTP 200) and the full webhook→ledger path using *synthesized, correctly signed*
  events (charge.refunded → refunded, dispute.closed/lost → chargeback, payment_intent.payment_failed →
  refunded) posted to the local `/api/webhooks/stripe`. All 9 checks passed; self-cleaning (conversions,
  ledger, tracking link, webhook_events, smoke notifications). No Stripe API calls, no money moved —
  safe with live keys present.
- Verification: typecheck clean · lint 0 errors (6 pre-existing warnings) · 162/162 tests · build passes.
- Not deployed. Preview at http://localhost:3000. Test accounts: willgreer38@gmail.com / wgreer301@gmail.com (both / 123456).

## Batch: publish to production, dev/admin account, demo-data reset, plan caps (Aug 19)

- **PUBLISHED** — committed 102 files and pushed `main` (16ae547). Vercel auto-deploys on push.
- **Demo data removed** — `scripts/reset-demo-data.mjs` cleared seeded campaigns, applications,
  rollups, socials, reviews, notifications, and reset the two profiles' bio/niches/tier/rating to
  defaults. Production DB now has only the two clean test accounts (no fake data).
- **Plan page caps** — creator Plan page now shows a "Your active-campaign limits" card with
  Tier cap / Plan cap / Effective cap (min of the two).
- **Dev/admin account** — promoted `willgreer38@gmail.com` to `app_metadata.role = "admin"`.
  Admin routes are gated on MFA (aal2): the user must visit /admin/mfa-setup and enroll TOTM
  before /admin works. Business dashboard still reachable (user_metadata.role stays "business").
- Verification: typecheck clean · lint 0 errors (6 pre-existing warnings) · 162/162 tests · build passes.
- Production webhook smoke test still blocked on: env vars pasted into Vercel + prod URL +
  prod webhook secret (see WILL_ACTION_ITEMS / GO_LIVE_CHECKLIST).

## Batch: production smoke test passed, zero fake data, deploy check, empty states (Aug 19)

- **Production webhook smoke test PASSED 9/9** — local STRIPE_WEBHOOK_SECRET verified against
  the live endpoint (probe `scripts/probe-prod-webhook.mjs`), then the full synthesized
  charge/refund/dispute flow ran against https://adswish-lake.vercel.app with correct ledger
  transitions and complete cleanup. Smoke test is now self-contained (creates + removes its own
  temporary campaign) and takes a base URL arg.
- **Zero fake data in production** — verified all tables at 0: campaigns, conversions,
  tracking_links, ledger_entries, webhook_events, notifications, applications, reviews,
  clicks_log. New `scripts/purge-test-leftovers.mjs` removed orphaned ledger rows + stale events.
- **Deploy health check** — `scripts/check-deploy.mjs` curls the live URL + 5 key routes after
  every push (all 200). Optionally uses VERCEL_TOKEN if ever configured.
- **Directory empty states** — /creators and /businesses now show a friendly "No creators/businesses
  yet" card with a Join CTA when the directory is brand new (distinct from the filter-empty state).
- **Admin** — willgreer38@gmail.com has app_metadata.role=admin; MFA (aal2) still required by the
  admin layout. Published again: 16ae547 → 9b2365c, site healthy.
- Verification: typecheck clean · lint 0 errors (6 pre-existing warnings) · 162/162 tests · build passes.

## Batch: admin MFA loop fix (Aug 19)

- **Root cause of "MFA redirect nothing works":** the admin layout checked AAL and redirected
  to /admin/mfa-setup — but the layout also wraps the mfa-setup page itself, so any visit to
  /admin/mfa-setup at AAL1 became an infinite redirect loop (browser gives up, page never loads).
- **Fix:** moved the AAL2 gate into middleware (src/lib/supabase/middleware.ts), which knows the
  pathname and exempts /admin/mfa-setup; removed the AAL check from the admin layout. Verified the
  AAL call is pure local JWT decoding (works in Edge middleware, no network).
- **Hardened mfa-setup page:** detects an already-verified TOTP factor on load and offers a
  verify-only "Enter your code" flow instead of erroring on a duplicate enroll.
- Verification: typecheck clean · lint 0 errors (6 pre-existing warnings) · 162/162 tests · build passes.

## Batch: MFA redirect preservation, CSP hydration, and production regression tooling (Aug 19)

- **Admin login redirect fixed:** middleware now preserves the original protected path in `?redirect=` when sending an unauthenticated admin to `/login`. After sign-in, `/admin` returns to `/admin/mfa-setup` instead of silently landing on `/dashboard`.
- **Admin MFA page hydration fixed:** the admin-only CSP was blocking Next.js inline App Router bootstrap scripts. This left `/admin/mfa-setup` visually blank after the redirect. Admin CSP now allows required inline bootstrap scripts while still disabling `unsafe-eval`.
- **Dashboard noise fixed:** NotificationCenter waits for a real user ID before querying Supabase, preventing 400 requests with `user_id=eq.` during the creator Discover page's initial render. Deliverable +/- buttons now have accessible names.
- **Regression tooling:** `scripts/production-regression.mjs` exercises public, business, creator, and admin MFA routes in a real Chromium browser, checks placeholder links/unnamed buttons/client errors, and writes `PRODUCTION_REGRESSION.md`. It never creates campaigns/payments; any temporary MFA factor is cleaned up.
- **Deploy tooling:** `scripts/check-deploy.mjs` now reports Vercel production deployment state and deploy URL when `VERCEL_TOKEN` is available, using the linked `.vercel/project.json` as the project-ID fallback. No token exists in `.env.local` yet; it must be supplied by the account owner and is never committed or printed.
- Verification before deploy: typecheck clean · lint 0 errors (6 warnings) · 162/162 tests · build passes.
- **Production sweep after commit 09c6171:** 40 checks passed and 0 failed across public, business, creator, and the admin MFA gate. The six protected admin pages are marked skipped in the report because the existing admin factor's secret was not stored in the workspace; the earlier production admin MFA run verified all six at HTTP 200. No campaign/payment data was created.
- **Live status:** https://adswish-lake.vercel.app is healthy on all deploy-check routes. Vercel API build state/URL reporting is wired, but `VERCEL_TOKEN` is still missing from `.env.local`; the account owner must add the token locally to enable that optional API check.

## Batch: admin controls and manual follower proof (Aug 19)

- **Migration 031 applied to Supabase:** manual verification rows now have one current submission per creator/platform, claimed follower count, handle, review notes, timestamps, and a private `creator-verification` Storage bucket with owner-scoped policies.
- **Creator workflow:** profile and onboarding submissions for TikTok, Instagram, and YouTube upload a screenshot through `/api/internal/manual-verifications`. Manual counts remain unverified and do not change the public social account or tier until approved.
- **Admin workflow:** `/admin/manual-verifications` shows signed screenshot previews and approve/reject controls. Approval updates the verified social account, recalculates the highest verified creator tier, writes an audit log, and notifies the creator.
- **Account administration:** `/admin/users` now supports suspend, reactivate, ban, and unban actions for creators and businesses. Actions are audit logged and notify the target. Middleware blocks suspended/banned dashboard, onboarding, and internal API access and routes users to `/account-suspended`; admins can still restore accounts.
- **Verification before publish:** typecheck clean · lint 0 errors (6 pre-existing warnings) · 162/162 tests · build passes.

## Batch: master blueprint audit and safety fixes (Aug 19)

- Added `BLUEPRINT_GAP_AUDIT.md`, mapping the v4 blueprint to implemented routes, migrations, jobs, owner-only setup, deliberate GBP/pg_cron/in-house telemetry deviations, and remaining launch gaps.
- Added server-side application gates: a creator cannot apply without Stripe Connect readiness and one verified 1,000+ follower social account; onboarding skip buttons no longer bypass the real requirement.
- Replaced creator overview fake zeros with ledger-backed fixed/affiliate/hybrid earnings and real accepted-campaign progress. Added creator MP4 upload controls and public rendering of approved portfolio videos.
- Added GDPR JSON export at `/api/internal/data-export` and a Settings download card; exports omit OAuth tokens and secrets.
- Replaced the daily analytics cron placeholder with `aggregateDailyRollups()` and migration 033's authenticated schedule.
- Made payout invoices private, normalized invoice paths, added signed creator-scoped downloads, and fixed weekly payout processing so failed/not-ready Stripe transfers are retried instead of being marked paid.
- Added admin manual-strike controls and audit-logged SLA dismiss/force-release/refund actions.
- Aligned live amount displays and DB defaults/catalog currency to GBP via migrations 032 and 034 (migration 034 also protects payout invoices).
- Migrations **032, 033, and 034 applied successfully** to Supabase. No fake campaigns, conversions, screenshots, or money movement created.
- Creator plan usage now counts only accepted campaigns that are still active/paused, matching the enforced active-campaign cap and the Plan page explanation.
- Remaining gaps and owner-only steps are recorded in `BLUEPRINT_GAP_AUDIT.md`; the homepage still has explicitly labelled illustrative demo cards, and admin moderation/status emails remain an open workflow.
- Verification after the final cap fix: typecheck, lint, 162 tests, and production build all pass.
- Commit `f3c4ecb` is pushed to `main`; the public health check returned 200 for `/`, `/plans`, `/businesses`, `/creators`, `/login`, and `/signup` after the deploy wait. Vercel build-state/API confirmation remains blocked only by the missing owner-supplied `VERCEL_TOKEN`.
