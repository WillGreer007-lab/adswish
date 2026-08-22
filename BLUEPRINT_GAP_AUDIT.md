# Adswish Master Blueprint v4 audit

**Audit date:** 19 August 2026
**Scope:** `ADSWISH_MASTER_BLUEPRINT_v4.md` mapped against the current Next.js routes, Supabase migrations, server-side guards, dashboards, cron jobs, and CI.

## Executive status

The core marketplace is implemented: authentication, resumable onboarding, creator/business roles, campaign state, applications, deliverables, tracking redirects, conversion ledger, Stripe webhooks, subscriptions, realtime chat, analytics, manual follower proof, admin MFA, account suspension, and public marketplaces are all present in code.

This is not a claim that the product is launch-complete. The largest remaining launch risks are external configuration and operational hardening: Stripe Tax/tax-form configuration, third-party social app review, email-domain deliverability, backups/PITR/WORM retention, load testing, and a few workflows listed below.

The live platform settles in **GBP**, which intentionally overrides the blueprint's original USD examples. New currency defaults, conversion rows, ledger rows, plan catalog rows, and the primary dashboard displays are now aligned to GBP.

## Implemented in this audit batch

- **Server-side creator eligibility gates:** applying now requires a ready Stripe Connect payout account and at least one non-disconnected, verified TikTok/Instagram/YouTube account with at least 1,000 followers. Skipping onboarding cannot bypass these requirements.
- **Creator overview data:** replaced hard-coded zero earnings and the always-empty active-campaign panel with ledger-backed per-payment-type totals and real accepted-campaign progress.
- **Creator deliverable upload UI:** the existing secure MP4 endpoint is now reachable from the creator campaign screen; the published URL remains required for submission.
- **Public portfolio:** approved uploaded videos now render on creator public profiles.
- **GDPR export:** `/api/internal/data-export` and a Settings → Download my data card export the authenticated account's profile, campaigns, applications, deliverables, messages, reviews, connections, subscriptions, ledger, and invoices without OAuth tokens or secrets.
- **Analytics materialization:** the daily rollup cron now calls a real idempotent worker instead of `SELECT 1` (`aggregateDailyRollups`).
- **Payout invoice privacy:** payout invoices are private in Storage and served through short-lived, creator-scoped signed URLs.
- **Admin controls:** manual strike is available beside suspend/ban, and the SLA dashboard now has confirmation-gated dismiss, force-release, and refund-business actions. Every action is audit logged.
- **Currency consistency:** new database defaults and plan catalog use GBP; major creator, business, campaign, admin, invoice, and plan surfaces no longer display USD symbols for live amounts.

## Blueprint map

### Green — implemented and wired

- Supabase Auth email/password and Google OAuth callback.
- Required Terms and Privacy checkboxes on password and Google signup.
- Creator/business onboarding state persisted in profiles.
- Stripe Checkout subscription flow and plan dashboards with limits.
- Creator tier badges and plan caps; business monthly campaign caps.
- Public creator and business directories with real empty states.
- Campaigns, drafts, visibility, duplicate, templates, per-deliverable deadlines, hashtags, manual review flag, budget pause trigger, applications, accept/reject/withdraw, invite auto-apply, and chat unlock.
- Deliverable URL submission, oEmbed/hashtag check with manual fallback, Sightengine auto-flagging, business approval, tracking-link creation, and MP4 Storage upload.
- Edge redirect with HMAC JWT, 24-hour handoff expiry, rate limiting, click logging, revoked-JTI Redis/Postgres checks, and 410 responses.
- Pixel heartbeat, S2S conversion endpoint, consent-gated first-party cookie, UTM fallback fields, 90/10 ledger math, hold/release/refund/chargeback handling, webhook signature verification, idempotency, retry queue, and failed-job records.
- Stripe Connect account creation/onboarding link, readiness polling, creator payout and business cash-out paths.
- Notification center, notification preferences, realtime messages/unread notifications, PII filtering, spam checks, presence and typing indicators.
- Reviews, right-to-reply window, aggregate rating trigger, review reporting, manual follower review queue, account suspension/ban/reactivation, admin MFA, audit log viewer, fraud feed, telemetry, and SLA command center.
- Appearance preferences (theme, font size, accent, background, layout), site-wide external-link warning, global back button, SEO routes, robots, sitemap, and OpenGraph root/creator metadata.
- CI workflow for lint, typecheck, Vitest, Playwright, production build, and Storybook build.

### Deliberate architecture deviations

- **GBP instead of blueprint USD:** required by the live Stripe platform configuration. Stripe calls use `getStripeCurrency()` and migration 032 aligns new DB defaults.
- **Supabase pg_cron instead of Inngest:** migrations 005/011/019 use authenticated pg_cron HTTP jobs. The old Inngest dependency and dead routes were removed. This is operationally simpler but does not provide Inngest's event-level sleep/cancellation semantics.
- **First-party telemetry instead of Sentry/PostHog:** `analytics_events` and `error_events` provide in-house capture and admin viewing. Sentry/PostHog remain optional future integrations, not required for the current pre-launch deployment.

## Remaining code gaps

These are not fabricated as complete merely because a page exists:

1. **Follower re-check worker is still a cron stub.** OAuth token refresh exists, but the monthly job does not yet call each platform's follower-count API, update tier history, or send the three escalating token-failure emails.
2. **Partition maintenance is still a cron stub.** The current database has dated partitions; the monthly partition-creation job should be replaced with a dynamic SQL function before sustained production traffic.
3. **Campaign asset creation uses a URL, not a business upload control.** Creator deliverable MP4 upload is now wired in the UI, but campaign preview image/video upload still needs a brokered `campaign-assets` bucket and an owner-scoped upload route.
4. **Upload virus scanning is not installed.** The video route validates MP4/50MB and Sightengine can flag submitted URLs, but Cloudmersive/ClamAV scanning is not configured.
5. **Creator tax-form collection is not an Adswish UI.** Payout code blocks until `tax_form_status = approved`; the actual W-9/W-8BEN/Stripe tax completion must be configured and completed in Stripe Connect.
6. **Account deletion is not self-service.** The GDPR JSON export is now implemented. A safe deletion flow still needs pending-hold/balance checks, anonymisation rules, confirmation, and an admin/audit path.
7. **Team seats have an API but not a complete invitation UX/email lifecycle.** The profile page now reads the actual team schema; email invitation, acceptance, removal, seat-cap enforcement, and team-member dashboard routing need a dedicated pass.
8. **Pagination is bounded but not cursor-based.** Most screens use limits (20–2,000). Keyset/cursor pagination is still needed before tables can approach the blueprint's 10,000-row threshold.
9. **Immutable WORM audit archival is not configured.** Admin audit rows are append-only from the app and readable by admins, but S3 Object Lock/separate audit storage is an infrastructure task.
10. **Load/performance testing has not been run.** The 10k-RPS edge test, Lighthouse budgets, Core Web Vitals, and connection-pool exhaustion test remain open.
11. **Operational services are owner configuration:** backups/PITR, cross-region replication, status page, help widget, verified Resend domain/SPF/DKIM/DMARC, Stripe Tax, and social-provider app review.
12. **The marketing homepage still contains explicitly labelled demo/illustrative cards and metrics** (`src/app/page.tsx`). They are not database fixtures, but a strict no-fabricated-data launch should replace them with neutral diagrams or real, consented directory aggregates before public launch.
13. **Admin moderation/status email delivery is incomplete.** Manual follower approval/rejection and account suspend/reactivate currently create in-app notifications; Resend templates cover campaign acceptance/closure, but these admin events still need transactional email templates and delivery logging.

## Owner-only checklist

1. In Vercel Production, verify `STRIPE_CURRENCY=gbp`, `CRON_SECRET`, `STRIPE_WEBHOOK_SECRET`, Supabase service credentials, Resend, Sightengine, and OAuth variables are present; redeploy after any change.
2. In Stripe, enable/configure Stripe Tax and complete the Connect platform profile. Each creator/business must complete its own hosted Connect onboarding and any required tax forms.
3. In Resend, verify the sending domain and publish SPF, DKIM, and DMARC before relying on transactional email.
4. In Google Cloud, enable YouTube Data API v3 and publish the consent screen or add test users. TikTok/Instagram keys and provider app review are separate owner actions.
5. Create an UptimeRobot HTTP(s) monitor for the verified domain, then map its numeric monitor ID in Business → Tracking. Monitor-only mode uses the server-side `UPTIME_ROBOT_MONITOR_API_KEY`; it does not require all-account or management access.
6. Create a Vercel personal token only in local `.env.local` if authenticated build-state output is needed from `scripts/check-deploy.mjs`; never commit or paste it into chat.
7. Publish the Chrome extension through the Chrome Web Store developer console; the repository package is prepared, but store review cannot be automated from this checkout.
8. Have counsel review Terms, Privacy, Cookie Policy, DPA/MSA, payout language, and the UK/GBP consumer/tax implications before public money movement.
9. Enable and test Supabase backups/PITR, decide the archive region and WORM audit-retention provider, and run a restoration drill.
10. Complete a real browser smoke pass with one creator, one business, and the MFA-protected admin account after the external steps above. Do not use live Stripe charge scripts with the live keys in `.env.local`.

## Verification target

After the code changes in this audit, run the mandatory gate in order:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Then run the public health check and a signed-in browser regression. No fabricated production campaigns, applications, conversions, screenshots, or payments should be created merely to populate a dashboard.
