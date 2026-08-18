# Adswish — AI Build Prompt (Master Blueprint v4.0)

---

## 1. Role & Mission

You are acting as a Principal Full-Stack Engineer and UI/UX Designer. The goal is a production-ready, fully functional Creator Marketplace Platform called Adswish — a two-sided marketplace connecting businesses with content creators for affiliate, fixed-fee, and hybrid influencer campaigns, with tracking, escrowed payouts, and mutual accountability built in on both sides. Creators keep 90% of everything they earn.

You have terminal, file-system, and internet access in this project directory and are authorized to run the commands needed to scaffold, build, and test the app. Ask before doing anything destructive outside this folder. All destructive operations (deletions, bans, force-releases) must be confirmable via UI and logged immutably.

---

## 2. Ground Rules

- No mock data, fake functions, or placeholders in production. Every feature is wired to a real database and real APIs (test-mode keys during development, live keys only at launch). Staging environments may use anonymized seed data for E2E tests; production never serves mocks. Feature flags may gate incomplete features, but gated features must still be wired to real backends.
- Build iteratively, phase by phase, per §18. Don't skip ahead.
- Test after every phase — the specific checks listed per phase, not just "click around."
- Secrets never live in code or in this document. All keys go in .env.local and are gitignored.
- Use the internet: Regularly browse dropship.io to match UI/UX patterns exactly. Look up official documentation for Next.js, Supabase, Stripe, and Inngest when implementing specific edge cases.
- No AI-based video editing, generation, or auto-dubbing. The video pipeline for v1 is direct MP4 upload only (§3). No AI scraping or auto-verification of submitted videos — approval is a human business owner checking a box, UI-authenticated, not a model making the call.
- Branch protection: main deploys to production; staging branch auto-deploys to a staging Vercel project. Financial webhooks must point to different Stripe webhook endpoints per environment to prevent test events from touching live money. Database migrations must run successfully in CI against a fresh clone before main merge.

---

## 3. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript — create-next-app@latest |
| Styling | Tailwind CSS + shadcn/ui |
| Database / Auth / Storage / Realtime | Supabase (Postgres, pg_cron, pgcrypto) — see §17 for alternatives |
| Payments | Stripe Connect Express (creator payouts) + Stripe Billing (subscriptions) + Stripe (business payment method) — one flat 10% commission on transactions + optional subscription tiers |
| Video | Direct MP4 upload to Supabase Storage for v1 (max 50MB, 1080p, served via native `<video>`). HLS/Mux upgrade path documented for v2 if portfolio engagement justifies it. |
| Rate limiting | Upstash Redis (token bucket) on pixel-pings, auth endpoints, tracking redirects, and public APIs |
| Hosting / Edge | Vercel, Edge Functions for the tracking redirect |
| Testing | Vitest (Unit/Integration) + Playwright (E2E) |
| Error Tracking | Sentry (Next.js SDK) — surface edge function failures and webhook timeouts |
| State Management | Zustand (ephemeral UI state) + TanStack Query (server state, caching, deduping) + URL search params (dashboard filters/toggles) |
| Email | Resend (default) or Postmark (transactional) |
| Product Analytics | Vercel Analytics for v1 web vitals and traffic. PostHog (funnels, cohorts, feature flags) enabled at 100+ active users (v2). |
| Animation | Framer Motion (explicit, performant animations) + @number-flow/react (mono number rollovers) |
| Search (v1) | Postgres full-text search; migration path to Meilisearch/Algolia documented at approximately 10,000 campaigns |
| Image Optimization | next/image with Supabase Storage remote patterns |
| Logging | Structured JSON logs via Pino in background jobs. Vercel native logging for serverless functions. 30-day retention on Vercel, 1-year archive in S3 for audit. |
| Connection Pooling | Supabase PgBouncer in transaction mode. All serverless functions and Edge Functions use the pooler connection string, never the direct Postgres port. |

### 3.1 UI Component Strategy

| UI Library | Best Used For | Selection Rationale |
|---|---|---|
| shadcn/ui | The Dashboard & Core Components | Clean, unopinionated foundation elements (modals, inputs, tables, dropdowns) that fit a data-dense product. Built on Radix primitives. |
| Framer Motion | Landing Page & Micro-interactions | Explicit, performant animations. Use for hero entrance sequences, card hover lifts, and dashboard number rollovers. |
| @number-flow/react | Dashboard Financial Metrics | Beautiful, accessible number transitions for earnings widgets. |
| Tremor | The Dashboard (Analytics) | Specifically built for fast, beautiful dashboards. Charts, KPIs, and data grids out-of-the-box. |

Animation libraries were evaluated and rejected in favor of Framer Motion for bundle-size and accessibility reasons.

### 3.2 Project Directory Architecture

To maintain separation of concerns and security, adhere strictly to the following Next.js App Router directory structure:

- `app/(marketing)/` — Landing page, guides, public legal pages, blog, sitemap.ts, robots.ts.
- `app/(auth)/` — Login, signup, onboarding flows, plan selection.
- `app/(dashboard)/creator/` — Creator-specific routes (protected by middleware).
- `app/(dashboard)/business/` — Business-specific routes (protected by middleware).
- `app/(admin)/` — Superadmin routes (protected by strict role check + TOTP MFA enforced at middleware).
- `app/api/v1/` — Public/external API routes (versioned).
- `app/api/internal/` — Internal dashboard API routes (not versioned).
- `app/api/webhooks/` — Webhooks (Stripe, Supabase Storage, S2S tracking).
- `app/t/[slug]/route.ts` — The Edge Function for tracking redirects. Must return 410 Gone for revoked slugs.
- `lib/supabase/` — Server and browser Supabase clients, RLS helpers.
- `lib/stripe/` — Stripe client initialization, webhook helpers, subscription helpers.
- `lib/inngest/` — Background job definitions (grace period kick engine, SLA timers, subscription renewals, video processing for v2).
- `lib/emails/` — React Email templates (default). MJML as fallback.
- `lib/analytics/` — PostHog wrappers and event definitions (v2).
- `components/ui/` — shadcn/ui primitives.
- `components/dashboard/` — Shared dashboard components (widgets, charts, empty states).
- `supabase/migrations/` — Version-controlled SQL migrations (every change via CLI; manual dashboard edits prohibited).
- `supabase/seed.sql` — Realistic local development seed data.
- `docs/screenshots/` — Visual references scraped from dropship.io.
- `docs/api/` — OpenAPI specs for internal API contracts. Generate from Zod schemas where possible.

---

## 4. Brand & Design Direction

**Palette:** Paper `#F5F6F9` · Surface `#FFFFFF` · Ink `#12141C` · Ink-soft `#565A68`. Payment-type colors: Fixed = amber `#D99A2B` (decorative only — never for text under 24px), Affiliate = blue `#3A5CE0` (deepen to `#2C46B8` for text-bearing fills), Hybrid = violet `#7C5CE0`. Status colors: `#10B981` active/success, `#EF4444` offline/danger, `#F59E0B` warning.

**Typography:** Headings Bricolage Grotesque · Body Inter · Numbers/codes IBM Plex Mono. Configure tailwind.config.js explicitly with CSS variables: `--font-heading`, `--font-body`, `--font-mono`. Use next/font with subsetting (subsets: ['latin'], explicit weight arrays) at the root layout level to prevent layout shifts.

```js
// tailwind.config.js
fontFamily: {
  heading: ['var(--font-bricolage)', 'sans-serif'],
  body: ['var(--font-inter)', 'sans-serif'],
  mono: ['var(--font-ibm-plex-mono)', 'monospace'],
}
```

**Accessibility:** WCAG 2.1 AA compliance is mandatory. Amber `#D99A2B` on white `#FFFFFF` fails contrast (2.8:1). Use amber only for decorative elements ≥24px or on dark backgrounds. All icon-only buttons require `aria-label`. Keyboard navigation must work for the lock-and-key grid and all modals.

**Responsive:** Mobile-first Tailwind breakpoints. Test on 320px widths. The dashboard must be usable (not just readable) on mobile.

**Dark mode:** Configure `darkMode: 'class'` in Tailwind now. Define all color tokens as CSS variables in `:root` and `[data-theme='dark']` scopes. Ship light-mode only at launch.

**Loading states:** Every async action (apply, approve, upload, payout) needs a designed skeleton screen (gray pulse blocks) or optimistic UI.

**Dynamic OG Images:** Public campaign and creator profile pages generate shareable OpenGraph images via @vercel/og Edge Function. Cache generated images in Supabase Storage for 24 hours.

### Landing Page Walkthrough

The hero follows dropship.io's "proof before pitch" strategy. A live-feeling strip of campaign cards sits directly under the headline — not a stock photo or abstract graphic. Further down, a feature deep-dive pairs a short claim with literal code: the pixel snippet and a live attribution line. Below that, a tool grid names each capability the way dropship names its own tools. Each tool gets its own icon in a light-blue glass badge. The lock-and-key mechanic lives inside that grid and in a Perks section — distributed through the page rather than concentrated in one hero visual. A Guides section, a dark CTA, and a full multi-column footer close it out.

- **Nav** — checkmark-in-a-blue-square logo, "adswish" wordmark, anchor links to Tools / How it works / Perks / Guides, a "Log in" link, and a filled "Get Started Free" button on the right.
- **Hero** — headline with one phrase in italic blue ("Discover creators who actually sell"), a one-line subhead, two CTAs ("Start a Campaign" filled blue, "Join as a Creator" outlined), and a short honest trust line under them — not fabricated user or GMV counts (Adswish is pre-launch, so those numbers would be false claims, not placeholder styling).
- **Campaign strip** — a horizontal row of 6–7 illustrative campaign cards directly under the hero, each with a payment-type badge (Fixed/Affiliate/Hybrid), an icon block, campaign name, business name + terms, and a "CREATORS EARNED" dollar figure. Cards labeled "Example campaigns" (badge positioned top-right, text-xs uppercase, muted gray background). The figures themselves are clearly fictional/demo data (e.g., "$12,450"). Never use real creator earnings without explicit consent.
- **Attribution deep-dive** — a "Pixel active" tag, the headline "One line of code. Total attribution.", three checkmarked bullets (first-party cookie scoped to the attribution window, edge-redirected links that survive ad blockers, heartbeat monitoring), and a dark code-block mockup (VS Code Dark+ theme) beside it showing the pixel `<script>` tag and a live `adswish.track(...)` conversion example with the resulting attribution line.
- **How it works** — a 4-step row, numbered 01–04: Post a campaign → Creators apply → Approve each video → Sales track, creators get paid.
- **Perks of Adswish** — two rows of three cards: Nobody has to go first (escrow), Every sale, tracked (pixel), Creators keep 90% (split) / SLA Guard (disputes), Review Engine (ratings), Creator Chat (messaging). Each card gets an icon badge, a headline, and a two-line description.
- **Tool grid** — "Everything you need to run creator campaigns," a 3×3 grid of the nine named tools listed above.
- **Guides** — "Guides to get you going," three article cards (For Creators / For Businesses / Engineering), each with an icon block, an eyebrow label, a headline, a description, and a "Read guide →" link.
- **Dark CTA** — "Launch your first campaign today," the same honest subhead as the hero's trust line, two buttons, on a full-bleed dark ink panel.
- **Footer** — logo + tagline, four link columns (Product / Creators / Businesses / Legal), a plain copyright line. No fabricated rating stat. No Trustpilot/Google rating widgets.

**Dashboard:** Persistent left sidebar, card-grid main area, real numbers given room to be the focal point (large, mono, not buried in small print). Similar to Linear's issue list or Vercel's analytics dashboard — dense, scannable, numbers-first. See §14 for the module breakdown.

**Visual reference:** see Appendix A for the screenshot set (dropship.io reference captures) and a section-by-section description of what everything should look like, with dropship.io as the standing example for every other surface of the site.

---

## 5. Onboarding & Account Setup

- Sign up by choosing a role (creator or business), and verify email.
- Redirect to a setup page before the dashboard is reachable. Store `onboarding_step` in the profile and email-drip users back if they abandon.
- Plan selection: Before profile setup, present the subscription tier options (§10.1). Users start on the Free plan and can upgrade anytime. Stripe Checkout handles the upgrade flow.
- Creator: display name, bio, profile photo. Then connect at least one social account (TikTok, Instagram, or YouTube) via that platform's official OAuth 2.0 login — never by scraping a public profile page, which breaks most platforms' terms of service; scraping is also fragile and easily broken by UI changes. Read the follower/subscriber count from the authenticated API response.
  - Tiered Access Gate (follower-based, separate from subscription plan):
    - **Micro (1,000–9,999 followers):** Fixed-fee campaigns only, limited to 2 simultaneously active (accepted) campaigns.
    - **Mid (10,000–99,999 followers):** Fixed + Hybrid campaigns, limited to 5 simultaneously active campaigns.
    - **Macro (100,000+ followers):** All campaign types, unlimited slots, priority placement in search (Macro creators appear at the top of applicant lists and in featured slots on the Discover page).
  - This lets the marketplace launch with liquidity. Tighten gates later based on data.
  - Platform-specific notes: TikTok's Display API exposes follower count directly. Instagram Graph API requires a business/creator account with `pages_read_engagement` and `instagram_basic` permissions; the Creator API is deprecated — do not use it. YouTube Data API v3 exposes subscriber count via `channels.list` with `statistics` part.
  - Where a platform's API doesn't expose follower count cleanly, fall back to a manual path: screenshot upload + admin approval, not a scraper.
  - Implement token refresh strategy for OAuth tokens (store `refresh_token` and `refresh_token_expires_at`, schedule refresh jobs before expiry). Handle rate limits from TikTok/Meta/Google APIs with exponential backoff. Apply for TikTok app review 4–6 weeks before launch. Use manual verification fallback until approved.
  - Token refresh failure: If a scheduled refresh fails (e.g., user revoked access), send 3 escalating emails over 7 days. If unresolved, mark the social account as disconnected but do NOT affect active campaigns. Block new applications until reconnected.
- Business: company name, logo upload, short bio. Then domain verification via DNS TXT record or meta tag to prove brand ownership. For Affiliate/Hybrid campaigns, manual business verification is required (upload business registration documents + VAT/EIN number). Automated KYB via third-party providers (SumSub, Onfido) is the documented upgrade path post-launch. Stripe Identity is NOT used for KYB — it verifies individuals, not businesses.
  - Domain verification: 3 automatic retry attempts over 24 hours. After 3 failures, manual admin review required. Businesses can switch to meta-tag verification as a fallback.
- Team Seats (Business): Business account owner invites users via email. Invited users authenticate via Supabase Auth with `app_metadata.business_id = {owner_id}`. RLS policies check `auth.uid() = business_id OR auth.uid() IN (SELECT user_id FROM business_team_members WHERE business_id = ...)`. See §15 for schema.
- Continue →
- Stripe setup: creator completes Stripe Connect Express onboarding (required before applying to any campaign). Business adds a payment method. Creators must complete Stripe Connect Express tax forms appropriate to their jurisdiction (W-9 for US, W-8BEN for non-US, etc.) during onboarding. Block payouts if tax information is missing or invalid.
  - Stripe Connect readiness: Handle Stripe `account.updated` webhooks. Check `charges_enabled` and `payouts_enabled`. If true and requirements are met, set `creator_profiles.stripe_connect_ready = true`. If requirements are pending, block applications and show a banner.
- Get Started → dashboard.
- Re-check follower counts periodically (pg_cron job running on the 1st of each month at 00:00 UTC). If a creator drops below their tier threshold later, block new applications rather than pulling them off campaigns already in progress.
  - Audit trail: Store `previous_tier` and `tier_changed_at` on creator_profiles to maintain history.
- Superadmin Provisioning: There is no public signup for Superadmin accounts. The first superadmin must be provisioned manually via a secure, local CLI script (e.g., `npm run seed:admin`) that updates the user's app_metadata in Supabase Auth. Only users with `role = 'admin'` in their JWT can access the /admin routes. All admin accounts must enable TOTP MFA before accessing any admin route. Enforced at the Next.js middleware layer: middleware verifies `user.app_metadata.role = 'admin'` AND `session.aal = 'aal2'`. Both must be true. If `aal != 'aal2'`, redirect to `/admin/mfa-setup`.

---

## 6. Compliance & Liability Shield

Before an account is created, users must check two separate boxes, both unchecked by default (GDPR requires active consent):

1. **Master Service Agreement:** "Adswish provides escrow and tracking tools. We are not a party to your campaign agreement. We mediate disputes per our SLA policy but do not guarantee campaign outcomes. Adswish charges a 10% platform fee on all transactions. This fee is non-refundable. By proceeding, you agree to our Terms of Service."
2. **Privacy Policy & Cookie Consent:** "I have read the Privacy Policy and consent to the processing of my personal data as described therein."

> ⚠️ This is placeholder copy for development, not real legal language. Have an actual lawyer draft the Master Service Agreement, Privacy Policy, Cookie Policy, and DPA (Data Processing Agreement) before any real user or real money touches the platform. Broad indemnification clauses are often unenforceable in the EU/UK under consumer protection law. Have local counsel review.

**GDPR Requirements:**
- Display a cookie consent banner on the marketing site before any analytics scripts load.
- The tracking pixel must check for explicit user consent before dropping the first-party cookie. The pixel accepts an optional consent flag in its initialization config (e.g., `adswish.init({ consent: true })`). If false or omitted, the pixel operates in analytics-only mode (sends pageviews but does not drop cookies). The business is the data controller for their own site; Adswish is the processor and provides the mechanism but does not assume legal coverage for the business's consent flow.
  - Check for `window.__cmp` (IAB TCF), `window.Cookiebot`, or `window.cookieConsent`. If no CMP is detected, default to a simple consent banner.
- Log consent records (timestamp, consent version, IP hash, user agent) to a `consent_logs` table for audit trails.
- Maintain a documented subprocessor list published at `/legal/subprocessors` and updated within 30 days of adding any new vendor.
- Data Retention Policy: Personal data retained for 7 years after account closure (financial record-keeping), then anonymized. Marketing/analytics data retained for 2 years.
- Data Export (GDPR Article 20): Users can export their data in a machine-readable format (JSON) via a "Download my data" button in Profile Settings. One-click export includes: profile data, campaign history, earnings history, messages, and reviews.

---

## 7. Profiles & Reputation

- **Creators:** profile picture, bio, portfolio grid of past videos (direct MP4 playback for v1), connected social accounts with follower counts, structured niche/tags drawn from a platform-curated list of 50–100 niches (creators select up to 5; businesses filter by these tags), subscription plan badge (Free/Pro/Premium).
- **Businesses:** logo, brand bio, history of past campaigns, verified domain badge (green checkmark next to business name on profile and campaign cards), subscription plan badge (Free/Growth/Enterprise).
- **Rating system:** both sides rate each other out of 5 stars with written feedback whenever a creator's deliverable track reaches a terminal state — full completion, an SLA auto-drop, or a creator being kicked for missing a deadline. Reputation reflects bad outcomes too, not just good ones.
  - Right to reply: When a business rates a creator, the creator can post a public response within 30 days of receiving the review. After 30 days, the review is locked.
  - Review notification: When a review is published, the reviewee receives an in-app notification and email with a direct link to reply. A daily cron sends a reminder at day 25 if no reply has been posted.
  - Review reporting: Users can flag defamatory or fake reviews for admin review.
  - GDPR compliance: Ratings persist for the lifetime of the account. Upon account deletion, the reviewer name is redacted (anonymized). Written feedback is deleted. Only the numerical rating (1–5) and date range (e.g., "Q2 2026") are retained for aggregate calculations. This satisfies Article 17 (Right to Erasure) while maintaining marketplace integrity.
  - Aggregate rating is public but anonymized after deletion.
  - Aggregate rating caching: Calculating `average_rating` on the fly via joins under RLS will kill database performance. Use a deferred trigger or materialized view refreshed every 5 minutes via pg_cron, rather than a synchronous row update. Synchronous triggers are acceptable for v1 only if wrapped in advisory locks.
- Account deletion with pending payouts: Creators cannot delete accounts with available balance > $0 or holds pending release. They must wait for all holds to clear and initiate a final payout. If account is deleted by admin (ban), remaining balance is forfeited to platform after 90 days per MSA terms.

---

## 8. The Marketplace

- **Campaign creation (business):** title, description, payment type (Fixed/Affiliate/Hybrid), amount and/or commission %, attribution window (1–30 days, Affiliate/Hybrid only), number of deliverables, deadline per deliverable, budget cap (maximum total spend — auto-pause when hit), visibility mode (public / invite / unlisted), niche/tags, currency (USD for v1).
  - Visibility modes: public (searchable, indexed), invite (searchable only to creators with a direct invite link), unlisted (not searchable, accessible only via direct URL).
  - Budget cap behavior: When the budget cap is reached, the campaign status changes to `paused_budget`. Existing accepted creators continue their deliverable tracks. New applications are blocked. Enforce atomically via Postgres trigger to prevent race conditions on simultaneous conversions.
  - Draft state: Campaigns are saveable as drafts before publishing.
  - Duplicate campaign: Clone past campaigns with all settings pre-filled.
  - Deliverable templates: Save "3 posts + 1 story" as reusable templates. Managed in the business dashboard under "Campaign Templates" or during campaign creation via a "Save as Template" toggle.
  - Campaign end date: Auto-calculated as `MAX(deliverable deadline) + 7 days`, or manually set by business.
- Pixel requirement: only Affiliate/Hybrid campaigns depend on tracking, so only those need a verified pixel (§11) before they can launch. A pure Fixed-fee campaign has nothing to track and launches without one.
- **Discovery (creator):** Postgres full-text search, filterable by business rating, payment type, commission %, attribution window, and niche/tags. Save filter combinations as reusable presets (creators: up to 5 on Free, unlimited on Pro/Premium; businesses: up to 10 on all plans).
- **Applications:** creator applies → business accepts or rejects (pending → accepted / rejected / withdrawn). A single campaign can have multiple accepted creators running in parallel, each on their own fully independent deliverable track.
  - Apply with one click: Pre-fills the application with the creator's profile data and tier badge. Creator adds an optional 280-character cover note.
  - Bookmark/save: Creators can save campaigns to a shortlist without applying. See `saved_campaigns` table in §15.
  - Application uniqueness: `UNIQUE(campaign_id, creator_id)` prevents duplicate applications. Return 409 Conflict if violated.
  - Application rate limit: Max 20 applications per 24 hours for Free creators, 50 for Pro/Premium. Enforced via Upstash Redis key `rate_limit:apply:{creator_id}`.
- Once accepted, a real-time chat unlocks between that creator and the business for negotiation. Rate-limit messages to 1 per 30 seconds per user via Upstash (`rate_limit:chat:{user_id}:{campaign_id}`) to prevent spam.
- Campaign terminal state: When all deliverables for all creators reach a terminal state (completed, kicked, or dropped), auto-set `campaigns.status = 'completed'`.

---

## 9. Deliverables — The Lock-and-Key

Each deliverable needs a unique hashtag (e.g., `#AdswishBrandAV1`). Hashtag format must be URL-safe and valid across TikTok, Instagram, and YouTube. Creators get a locked grid — Box 1, Box 2, Box 3 — not one generic link.

- **Submission:** creator posts to social with the required hashtag, pastes the URL into the open slot. The platform verifies the hashtag exists on the submitted URL via platform oEmbed API where available. If oEmbed is unavailable or returns ambiguous results, flag for manual admin review rather than auto-rejecting. Never scrape TikTok/Instagram pages directly — this violates their ToS and breaks constantly.
- **Approval:** the business reviews in the UI and must explicitly check "✅ I approve this advert and authorize tracking activation." Only then does that slot unlock the next one.
  - Bulk approval: For businesses with many deliverables, offer "Approve all pending for this creator" with a confirmation modal.
- **Content moderation:** Before business review, run uploaded video through AWS Rekognition or Sightengine to flag NSFW, hate speech, or copyrighted material. Auto-flag, don't auto-reject. AWS Rekognition costs approximately $1–2 per 1,000 images/minutes of video. Budget $50–100/month for moderation at launch scale. Sightengine offers a cheaper pay-per-request model for v1.
- **Deadlines & the 24-hour grace period:** each deliverable has a deadline.
  - If a creator has already submitted a URL, the slot is safe from the kick.
  - If the deadline passes with no URL submitted, an automated warning email goes out and a 24-hour grace period begins, with escalating reminders (email at T+0, SMS at T+12h if configured).
  - Deadline extension negotiation: Business and creator can mutually agree on a deadline extension via chat, which resets the kick timer. Store the Inngest event ID in `deliverables.grace_period_task_id`. On extension, call Inngest's cancel API to cancel the old task, then reschedule.
  - If the creator hasn't submitted within 24 hours, they're automatically removed and the slot is immediately relisted.
  - If the agreed number of deliverables isn't received, the business can drop the campaign without penalty.
- **State machine:** `pending` → `grace_period` → `kicked` (if no submission) OR `pending_business_review` (if submitted). Terminal states: `completed`, `kicked`, `dropped_by_business`, `auto_dropped_sla`.

---

## 10. Payments, Escrow & Subscriptions

### 10.1 Subscription Tiers

All monetary values in USD for v1. Multi-currency support is a v2 feature.

**Creator Plans (monthly, billed via Stripe Billing):**

| Plan | Price | Features |
|---|---|---|
| Free | $0 | Apply to campaigns, basic profile, standard support, 5 saved filter presets, basic earnings dashboard, 7-day hold on all payouts. |
| Pro | $5/mo | Everything in Free + priority applicant badge (businesses see you first), unlimited saved filters, advanced earnings analytics (cohort views), instant payout (skip 7-day hold). |
| Premium | $10/mo | Everything in Pro + "Verified Pro" badge on profile, campaign performance insights, dedicated support channel. |

**Business Plans (monthly, billed via Stripe Billing):**

| Plan | Price | Features |
|---|---|---|
| Free | $0 | Create up to 3 campaigns/month, basic pixel tracking, standard support, manual applicant review, CSV exports. |
| Growth | $7/mo | Everything in Free + unlimited campaigns, advanced pixel analytics (cross-device, cohort — v2), bulk approval tools, priority support, team seats (up to 2 users). |
| Enterprise | $15/mo | Everything in Growth + SLA guarantee (4-hour dispute response), team seats (up to 5 users), custom onboarding. White-label options, API access, and custom portfolio layouts are v2 features. |

**Subscription rules:**
- The 10% transaction commission applies to ALL plans. Subscription fees are separate and unlock features.
- Downgrades take effect at the end of the billing period. Upgrades are prorated immediately.
- If a subscription payment fails, grace period of 7 days before reverting to Free plan. Campaigns created under a paid plan remain active but no new paid features can be used.
- Free plan businesses are limited to 3 campaign creations per calendar month (not 3 active — 3 created). Deleting a campaign does not restore the quota. Track via `business_profiles.campaigns_created_this_month` (reset by pg_cron on the 1st).

### 10.2 Transaction & Escrow Logic

- Fixed-fee campaigns: Business is charged immediately upon approving a creator. Funds move to Stripe Connect hold.
- Affiliate/Hybrid campaigns: Business payment method is charged per conversion event via destination charge.
- On approval: the tracking link for that slot goes live, and any fixed milestone payment moves into a 7-day hold in Stripe Connect — shown to the creator as "Pending," not "Available." The 7-day hold begins at `approved_at` (when the business checks the approval box).
- Auto-release: if nothing is disputed, funds release to the creator's available balance automatically after 7 days. Pro/Premium creators can opt for instant release (skips hold).
- Partial refunds: If a creator delivers 2/3 deliverables then ghosts, the business selects which deliverables to pay for via checkboxes in the campaign detail view. Unpaid deliverables are refunded pro-rata. Not all-or-nothing.
- Disputes freeze the hold (§12) rather than the creator or business being able to force an outcome — an admin resolves it.
- Payout cadence: automatic weekly payouts via Stripe Connect every Monday at 00:00 UTC once funds clear the hold, subject to a minimum payout threshold of $25 USD. Otherwise you burn Stripe fees on micro-transfers.
- One fee, not two: the 10% commission is the only platform fee on transactions. The platform absorbs all underlying Stripe processing fees (2.9% + 30¢) entirely out of its 10% take. Creators always receive an exact, unreduced 90% net payout.
- Commission & Fee Absorption: When charging for a milestone or conversion, initiate a Destination Charge pointing to the creator's connected Express account:
  - `transfer_data.amount = round(total_amount * 0.90)` (round to nearest integer cent; if exactly 0.5¢, round down to avoid overpaying the creator beyond 90%)
  - `application_fee_amount = total_amount - transfer_data.amount`
  - Configure the platform account as the settlement merchant for transaction fees so processing deductions are debited from the platform's balance, not the creator's transfer.
  - Enable Stripe Connect account debits in platform settings to allow negative balances from clawbacks.
- Refund & Clawback Logic: If a business refunds a customer after the 7-day hold has auto-released, the platform must claw back the creator's 90% cut. Instruct the Stripe webhook to check the creator's Connect balance. If insufficient, Stripe debits the platform account for the shortfall. The creator's account is flagged and future earnings are garnished at 50% per payout until the platform is made whole. If the shortfall exceeds $500, flag for admin review and suspend the creator from new applications. Do not allow the creator to apply to new campaigns until the balance is positive.
- Currency Conversion: If a business pays in EUR and the creator's Connect account is USD, Stripe converts automatically (extra ~1%). The platform absorbs this to keep the 90% promise clean.
- Tax: Stripe Tax integration for automatic tax calculation on the 10% platform fee AND subscription fees. Stripe Tax must be activated in the Stripe Dashboard and tax categories configured before processing live transactions. Businesses need tax invoices too. Creators must complete Stripe Connect Express tax forms appropriate to their jurisdiction.
- Creators must complete Stripe Connect Express onboarding before they can apply to a campaign, so an approval never has nowhere to send money.
- Chargeback handling: First chargeback = flag for admin review, freeze related campaign payouts. Second chargeback within 30 days = suspend business account pending investigation. Do NOT auto-suspend on first chargeback — chargebacks are often friendly fraud by end customers.
- Invoice generation: Auto-generate monthly PDF invoices for creators summarizing all released payouts. Invoices stored in Supabase Storage and emailed via Resend.
- Escrow visibility: Both parties see exactly how much is in hold, for which deliverable, and when it releases. A "Financial Timeline" UI per campaign shows hold → pending → released → paid out.
- Financial reality check: At $10 transactions, platform net is approximately $0.31 after Stripe fees + conversion. Monitor unit economics closely. If average transaction size falls below $15, consider a minimum platform fee of $1.00 per transaction.

---

## 11. Tracking & Attribution

**Attribution model:** Last-click wins within the attribution window. If a user clicks multiple creators' links, the most recent click overwrites the cookie. The previous click's JWT is logged but not credited. This is non-configurable for v1.

- **Edge redirect:** a click on `adswish.com/t/{random_slug}` (8-character alphanumeric, opaque) hits a Next.js Edge Function, which looks up the destination in `tracking_links`, generates a signed JWT (`creator_id`, `campaign_id`, `deliverable_id`, `issued_at`, `ip_hash`, `ua_hash`, `exp`, `jti`), and redirects to the business's site with the token appended (`?adswish_ref=JWT_STRING`). Routing through your own edge function rather than a client-side call keeps this working through most ad blockers.
  - JWT expiration: Strict `exp` claim aligned with the campaign's active attribution window, capped at 24 hours for click handoffs. The JWT expires in 24h for handoff; the cookie persists for the full attribution window (1–30 days).
  - Validation: The Edge Function cryptographically verifies the HMAC signature against `JWT_SIGNING_SECRET` and validates expiration before issuing the HTTP 302 redirect.
  - Token rotation & blocklist: If a creator regenerates their tracking link (e.g., they leaked it), old JWTs must be invalidated. Maintain a `revoked_jtis` table in Postgres as the source of truth. Cache active revocations in Redis with AOF persistence for fast lookups. The Edge Function checks Redis first (fast path), falls back to Postgres on cache miss. Expired JWTs return 410 Gone (not 302 redirect).
- **First-party cookie:** on landing, the pixel script — executing in the business's page context — reads `window.location.search` for the `adswish_ref` query parameter and drops a first-party cookie on the business's own domain, `Max-Age` set exactly to the campaign's attribution window. Because this is a marketing/attribution cookie, it isn't "strictly necessary" under GDPR/UK-GDPR — the business's site needs a cookie-consent flow, and the pixel should only fire after consent.
- **Checkout webhook:** on the thank-you page, the pixel checks for the cookie, grabs order ID + amount, and POSTs to `/api/v1/webhooks/conversion`. The server verifies the JWT, calculates the 90/10 split, and moves the payout into the hold state from §10.
- **S2S Fallback:** Because GDPR consent can block the first-party cookie, the business's backend should capture and store the `adswish_ref` JWT server-side when the user initially lands on the business's site with the tracking parameter. At checkout, the backend POSTs the conversion to `/api/v1/webhooks/conversion` using this stored JWT. This ensures attribution survives even if the pixel script is blocked by consent management. The business backend CANNOT read the user's localStorage/sessionStorage from a server-side webhook — localStorage is origin-scoped and inaccessible across domains.
- **Pixel status:** red until the script pings the server, green once active. A campaign can't launch until verified (Affiliate/Hybrid only, per §8).
- **Attribution window visualization:** Show the business a calendar graphic: "If a customer clicks on Jan 1 with a 30-day window, attribution expires Jan 31."
- **Cross-device graph:** Surface mobile-click/desktop-purchase patterns in the business dashboard as a "Cross-device conversions" KPI. (v2 feature — requires sufficient data volume.)
- **Pixel installation helper:** Provide copy-paste snippet + GTM container template for v1. Shopify app embed block and WordPress shortcode are documented v2 integrations.
- **Attribution fallback parameters:** If the cookie is blocked, append UTM parameters to the destination URL (`utm_source=adswish&utm_campaign=...`) so the business at least has analytics visibility. Additionally, inject the `adswish_ref` JWT as a hidden form field on the business's checkout page (injected by the pixel) for maximum persistence.
- **Attribution method tracking:** Store `conversions.attribution_method` as `cookie`, `s2s`, `utm_fallback`, or `manual` for analytics and debugging.

---

## 12. SLA, Disputes & Accountability

- **Pixel heartbeat:** the pixel pings continuously. If it drops, the creator is alerted immediately and the business gets an automated warning email. If not restored within 12 hours:
  - Domain-scoped suspension: The suspension applies to the `verified_domain` associated with the offline pixel. Other `verified_domain` records under the same `business_profiles` row remain active. Stripe billing pauses for affected campaigns. Fixed-fee campaigns are unaffected. Offline badge remains for 30 days after restoration as a trust signal to creators.
- **3-day SLA:** if a creator reports a missing sale (tracked incorrectly) or delivered, approved work with no payment, a 72-hour SLA timer starts.
  - The "haven't been paid" reason only becomes available once `hold_expires_at` (§10) has passed without release — not immediately on approval, or every normal 7-day wait would look like a dispute. Available 24 hours after `hold_expires_at` to account for weekend Stripe processing delays.
  - The "sale didn't track" reason has no such gate.
  - Dispute evidence upload: Both parties can attach screenshots, screen recordings, and analytics exports to an SLA ticket.
  - Priority queue: Flag disputes involving >$500 or repeat offenders (business or creator with 2+ disputes in the past 90 days) for admin review within 4 hours, not 72.
- **Auto-drop:** unresolved after 72 hours → campaign auto-drops, tracking links disable, creator is freed, business takes 1 strike.
- **3-strike ban:** 3 strikes within any 12-month rolling window → business account banned 3 months, all active campaigns terminated.
- **Creator strike system:** Creators who repeatedly miss deadlines, submit fraudulent URLs, or bypass PII filters also accrue strikes. 3 creator strikes within any 12-month rolling window → account banned 3 months.
- **Pause functionality:** Allow businesses to pause campaigns (e.g., inventory out of stock) without it counting as a strike or triggering SLA. Pause button on campaign card with three options: "Pause new applications" (existing creators continue), "Pause all activity" (tracking links disabled, no new submissions), "Resume". Store `pause_reason` on the campaign record.

---

## 13. Anti-Fraud & Security

- **JWT fingerprinting:** the `adswish_ref` token carries an IP-hash + user-agent hash. A click on mobile and purchase on desktop falls back to cookie-based binding while flagging the pattern for review — surfaced, not auto-rejected.
- **Device fingerprinting:** v1 relies on velocity checks, rate limiting, and OAuth account uniqueness. FingerprintJS Pro is the documented upgrade path at >$100k GMV if fraud rates justify it.
- **Velocity checks:** Flag if application rate exceeds 3x the user's 7-day average. Baseline: more than 10 applications in 60 seconds triggers an auto-flag.
- **Rate-limited endpoints:** the pixel-ping endpoint, authentication endpoints (login/signup), and the tracking redirect edge function (`adswish.com/t/...` — max 100 requests per IP per minute) sit behind an Upstash Redis token bucket to block spoofed heartbeats, DDoS attacks, and brute-force credential stuffing.
  - Rate limit tiers: Free users = 30 req/min on public APIs. Paid users = 120 req/min. Pixel pings = 1 per 5 seconds per domain. Tracking redirects = 100 req/min per IP (all tiers).
- **Application rate limit:** Max 20 applications per 24 hours for Free creators, 50 for Pro/Premium. Enforced via Upstash Redis key `rate_limit:apply:{creator_id}`.
- **Row-Level Security** is mandatory on every table, scoped to `auth.uid()`. Build it alongside each table, not as a later pass. RLS policies must be tested in CI with a dedicated test suite that attempts cross-user reads/writes and asserts failure.
- **SQL injection testing mandate:** Even with Supabase RLS, require parameterized queries in all API routes. Add Snyk or GitHub Dependabot security scan to CI.
- **CSP headers:** Content Security Policy headers for the marketing site and dashboard to prevent XSS. Policy: `default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.supabase.co; connect-src 'self' https://*.supabase.co https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com;` This is critical for Stripe Elements to work.
- **Admin route security:** Serve admin from `/admin` path. Additional CSP: `frame-ancestors 'none'` to prevent clickjacking of admin panels. `Strict-Transport-Security max-age=1` year.
- **CORS Configuration:** Explicitly configure CORS for `/api/v1/webhooks/conversion` (accept POSTs from any origin — businesses POST from their own domains) and `/api/webhooks/stripe` (Stripe-only IPs). All other API routes: `Access-Control-Allow-Origin: https://adswish.com` only.
- **Pagination:** Cursor-based (keyset) pagination for all list endpoints (campaigns, messages, conversions, clicks_log). OFFSET pagination is prohibited for tables >10,000 rows.

---

## 14. The Dashboard

Persistent left sidebar for navigation; main area is a card grid; numbers get room to breathe. Use dropship.io's Sales Tracker and Product Database as the primary visual and interaction references. If paywalled, reference public screenshots in `docs/screenshots/`.

- **Sidebar nav:** Creator — Overview, Discover, My Campaigns, Earnings, Messages, Profile. Business — Overview, Campaigns, Applicants, Payments, Messages, Profile. Same icon-and-label pattern for both roles; the active item gets a light-blue background with a left accent, everything else stays a muted label until hovered.
- **Empty states:** Every widget needs a designed empty state (illustration + CTA), not a blank "0".
- **Notification center:** Bell icon with unread badges, grouped by type (payment, application, SLA, pixel offline). Users can mute email/push per notification type via `notification_preferences`.
- **Export to CSV:** Business dashboards need "Download conversions (last 30 days)" for their own finance tools. CSV format: Date, Campaign, Creator, Order ID, Amount, Creator Cut, Platform Cut, Status, Currency.

### Creator View
- Three earnings widgets up top — Fixed, Affiliate, Hybrid, colored per §4, split into Pending/Available, numbers in mono, rolling up on a new sale, with a today/7-day/30-day toggle.
- Below: active campaigns as cards showing lock-and-key progress at a glance. Each card shows a horizontal progress bar with N segments (one per deliverable). Filled segments = submitted/approved. Empty segments = pending. Red segments = overdue.
- The Discover tab works like dropship's Product Database: filterable by payment type, commission %, rating, attribution window, and niche, with the ability to save a filter combination as a reusable preset.
- A Profile tab shows connected social accounts, follower counts, and tier badge. Tier badge color-coded: Micro = gray, Mid = blue, Macro = amber.
- Plan upgrade CTA: Persistent but dismissible banner on Free plan: "Upgrade to Pro for instant payouts and priority placement."

### Business View
- Active campaigns as cards, each surfacing applicant count and pending-approval count directly. Pixel status shown per campaign (green pulse / red banner per §12).
- Clicking into a campaign opens a Sales-Tracker-style detail view: a conversions-over-time line with the same today/7-day/30-day toggle, and underneath it the creators actually driving those numbers, ranked.
- An applicant review queue.
- A payouts summary (total paid, escrow currently held).
- Creator CRM: Accessible from the Business dashboard sidebar as "My Creators." Shows a table: Creator name, tier, niche, campaigns worked together, total paid, average rating, last active date. Filterable by all columns.
- Plan usage meter: Free plan businesses see "3 of 3 campaigns used this month" with upgrade CTA.

### Superadmin (dark variant, ink #12141C as base)
- Financial ledger: GMV, platform revenue (the 10% take), subscription revenue (MRR), current escrow/hold balances, from `ledger_entries`.
- SLA dispute queue: each ticket shows the remaining 72-hour window; expands to chat logs, the submitted URL, and pixel/cookie history as evidence. "Force-release to creator" / "Refund business" buttons close the ticket.
- Entity management: full user directory, 360° view of campaigns/earnings/strikes/subscriptions, manual strike/ban controls.
- Fraud & health: `clicks_log` feed flagging repeated `ip_hash`/`user_agent` patterns; system vitals for edge function success rate, webhook failures, pixel uptime.
- Admin audit logs: Immutable log viewer. Read-only table with pagination, filterable by `admin_id`, `action_type`, and date range. No delete/edit buttons. Write admin audit logs to WORM storage (S3 Object Lock in Governance mode with 7-year retention) or a separate audit database. If an admin is compromised, they shouldn't be able to delete their own tracks.

---

## 15. Data Model (reference, not final DDL)

### Core Profiles
- `business_profiles` — user_id, company_name, logo_url, bio, account_status, strikes, average_rating, verified_domain, kyb_status (pending|verified|rejected|not_required), tax_jurisdiction, tax_id, paused_at, paused_by, deleted_at, campaigns_created_this_month INTEGER DEFAULT 0, campaigns_created_month TEXT DEFAULT ''
- `creator_profiles` — user_id, display_name, profile_picture_url, bio, account_status, strikes, average_rating, tier (micro|mid|macro), previous_tier TEXT, tier_changed_at timestamptz, onboarding_step, phone_number, deleted_at, stripe_connect_ready BOOLEAN DEFAULT false
- `creator_social_accounts` — creator_id, platform, handle, follower_count, verified_at, refresh_token, refresh_token_expires_at, token_expires_at
- `manual_follower_verifications` — creator_id, platform, screenshot_url, status, reviewed_by, created_at
- `business_team_members` — business_id uuid REFERENCES business_profiles(user_id), user_id uuid REFERENCES auth.users(id) PRIMARY KEY, role TEXT DEFAULT 'member', invited_at timestamptz, joined_at timestamptz

### Subscriptions
- `subscription_plans` — slug (creator_free|creator_pro|creator_premium|business_free|business_growth|business_enterprise), name, price_pence, currency, billing_interval (monthly), features (JSONB), created_at
- `creator_subscriptions` — creator_id, plan_slug, stripe_subscription_id, status (active|past_due|canceled|trialing), current_period_start, current_period_end, canceled_at, created_at
- `business_subscriptions` — business_id, plan_slug, stripe_subscription_id, status (active|past_due|canceled|trialing), current_period_start, current_period_end, canceled_at, created_at, team_seats_used

### Campaigns & Applications
- `campaigns` — business_id, title, description, type, commission_pct, fixed_amount, attribution_days, pixel_status, last_pixel_ping_at, offline_warning_sent_at, status, budget_cap, total_spent, visibility (public|invite|unlisted), niche (text[]), currency TEXT DEFAULT 'USD', end_date timestamptz, pause_reason TEXT, paused_at, paused_by, deleted_at
- `applications` — campaign_id, creator_id, status, applied_at, decided_at, cover_note, tier_at_application TEXT NOT NULL, withdrawn_at timestamptz, withdrawn_reason TEXT, UNIQUE(campaign_id, creator_id)
- `deliverables` — campaign_id, creator_id, slot_number, required_hashtag, deadline_date, warning_sent_at, submitted_url, hashtag_verified, business_approved, approved_at, tracking_link_id, status, extended_deadline_at, grace_period_task_id, deleted_at
- `tracking_links` — deliverable_id, creator_id, campaign_id, slug, destination_url, jti, revoked_at
- `saved_campaigns` — id uuid PRIMARY KEY, creator_id uuid REFERENCES creator_profiles(user_id), campaign_id uuid REFERENCES campaigns(id), created_at timestamptz DEFAULT now(), UNIQUE(creator_id, campaign_id)
- `campaign_templates` — business_id, name, type, commission_pct, fixed_amount, attribution_days, deliverable_count, niche, created_at, deleted_at

### Tracking & Conversions
- `clicks_log` — tracking_link_id, ip_hash, user_agent, jwt_fingerprint, clicked_at (partition monthly; archive >90 days to cold storage)
- `conversions` — tracking_link_id, order_id (TEXT), order_amount, currency, creator_cut, platform_cut, status (pending_hold|released|disputed|refunded|chargeback), hold_expires_at, disputed_at, attribution_method TEXT DEFAULT 'cookie'
- `daily_conversion_rollups` — campaign_id, creator_id, date, total_clicks, total_conversions, gross_sales, creator_cut, platform_cut (updated nightly by pg_cron; partition monthly, auto-create partitions on the 25th for upcoming month)
- `consent_logs` — user_id, consent_type (cookie|marketing|analytics), consent_version, granted_at, ip_hash, user_agent
- `revoked_jtis` — jti, revoked_at, reason

### Financials
- `ledger_entries` — related_conversion_id, related_deliverable_id, type (hold|release|refund|chargeback_clawback|platform_fee|stripe_fee|subscription_revenue), amount, stripe_transfer_id, currency, created_at
- `payout_invoices` — creator_id, month_start, month_end, total_released, pdf_url, sent_at

### Reviews & Messaging
- `reviews` — reviewer_id, reviewee_id, campaign_id, rating_out_of_5, written_feedback, creator_response, reported_by, created_at
- `messages` — campaign_id, sender_id, body, created_at, encrypted_body (via pgcrypto)
- `message_reads` — message_id uuid REFERENCES messages(id), user_id uuid REFERENCES auth.users(id), read_at timestamptz DEFAULT now(), PRIMARY KEY (message_id, user_id)

### Operations
- `sla_disputes` — related_deliverable_id, related_conversion_id, raised_by, reason, status, evidence_urls (TEXT[]), opened_at, resolved_at, resolution (force_release|refund_business|split|dismissed), admin_id
- `webhook_events` — event_id, provider, payload, created_at
- `notifications` — user_id, type, body, link, read, email_sent, push_sent, created_at
- `notification_preferences` — user_id PRIMARY KEY, muted_types TEXT[], email_enabled BOOLEAN DEFAULT true, push_enabled BOOLEAN DEFAULT true, updated_at
- `admin_audit_logs` — admin_id, action_type (force_release|refund|ban_user|unban_user|resolve_dispute|manual_strike|override_rating), target_entity_id, metadata (JSONB), created_at (write to WORM storage or separate audit DB)
- `failed_jobs` — job_type, payload, error_message, attempt_count, last_attempted_at, created_at

### Indexes (mandatory)
- `campaigns(business_id, status, created_at)`
- `campaigns(visibility, status, niche)` GIN index on niche
- `applications(campaign_id, status)`
- `applications(creator_id, status)`
- `applications(campaign_id, creator_id)` UNIQUE
- `deliverables(campaign_id, creator_id, status)`
- `deliverables(deadline_date, status)` (for kick engine)
- `deliverables(grace_period_task_id)`
- `conversions(tracking_link_id, created_at)`
- `conversions(order_id)` (for business reconciliation)
- `clicks_log(tracking_link_id, clicked_at)` (partitioned monthly; local indexes per partition)
- `messages(campaign_id, created_at)`
- `message_reads(message_id, user_id)`
- `reviews(reviewee_id, created_at)`
- `notifications(user_id, read, created_at)`
- `tracking_links(jti)` (for blocklist lookups)
- `creator_profiles(tier, account_status)` (for discovery filtering)
- `business_profiles(verified_domain)` (for domain-scoped suspensions)
- `revoked_jtis(jti, revoked_at)`
- `creator_subscriptions(creator_id, status)`
- `business_subscriptions(business_id, status)`
- `saved_campaigns(creator_id, campaign_id)`
- `business_team_members(business_id, user_id)`

---

## 16. Environment & Accounts — Set Up Before Phase 1

- Supabase project (URL, anon key, service-role key)
- Stripe account with Connect Express + Billing enabled (test-mode keys, webhook signing secret). Activate Stripe Tax in Dashboard and configure tax categories.
- Upstash Redis database (REST URL + token)
- Inngest account (for background job orchestration — grace period, SLA timers, subscription renewals)
- Resend account (API key). Configure SPF, DKIM, and DMARC for the sending domain before sending transactional emails. Verify domain in Resend dashboard.
- PostHog project (API key, host) — v2, enable at 100+ active users
- A domain, with DNS access
- Vercel project for hosting + Edge Functions

**.env.local** — for local development only. Use Vercel Environment Variables for production/staging.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_TAX_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
JWT_SIGNING_SECRET=
MESSAGE_ENCRYPTION_KEY=
NEXT_PUBLIC_APP_DOMAIN=
RESEND_API_KEY=
POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_KEY=
POSTHOG_HOST=
SENTRY_DSN=
AWS_REKOGNITION_ACCESS_KEY=
AWS_REKOGNITION_SECRET_KEY=
```

Maintain separate `.env.staging` and `.env.production` files. Never commit `.env.local`.

---

## 17. Supabase Alternatives

Supabase bundles Postgres, auth, storage, and realtime in one place, which is why it's the default. Worth swapping only for a specific reason:

| Option | Trade-off |
|---|---|
| Firebase | Very mature, real-time by default — but Firestore is NoSQL, so §15's relational model needs rethinking, not porting. |
| Neon (Postgres) + Clerk (auth) + Cloudflare R2 (storage) | Real Postgres, best-in-class pieces — three services to wire and pay for instead of one. Neon branching is a killer feature for per-PR staging environments. Supabase also offers preview branches now (in beta), reducing the Neon advantage. |
| Appwrite | Open-source, self-hostable, similar bundled shape — smaller ecosystem. |
| PocketBase | Extremely simple, single-binary, SQLite — great for a prototype, not built for this app's eventual concurrency. |
| AWS Amplify | Maximum control and scale — meaningfully more setup and ops work for a solo build. |

Unless one of those trade-offs matters specifically, Supabase stays the better fit here.

---

## 18. Phased Build Plan

### Phase 0 — Design System & CI/CD (Pre-requisite)
- Establish Storybook with all base components. Do not use /design-system route as a shortcut.
- GitHub Actions: lint, type-check, Vitest, and Playwright on every PR.
- Staging environment deployed with separate Stripe webhook endpoints. Endpoint naming: `/api/webhooks/stripe?env=staging` or separate routes `/api/webhooks/stripe/staging`.
- Test: CI passes on an empty repo; staging deploys automatically.

### Phase 1 — Foundation, Auth & Onboarding
- Next.js scaffold, Tailwind theme (§4), font subsetting via next/font.
- Landing page built toward the dropship.io reference.
- Initialize Supabase CLI for local development & migrations.
- Supabase Auth (creator/business/admin) + email verification + deliverability testing.
- Full onboarding flow (§5): profile setup, social OAuth + tiered follower gate, subscription plan selection, Stripe setup, resumable onboarding state.
- T&C + Privacy Policy + Cookie consent checkboxes (§6), both unchecked by default.
- Connection pooling: Configure Supabase PgBouncer and use pooler connection string in all serverless functions.
- Standardize currency: All pricing, escrow, and payouts in USD.
- Test: verify → profile → plan selection → Stripe → dashboard works for both roles end to end; a creator with 999 followers is blocked, a creator with 1,000 followers is assigned Micro tier; RLS on from the start; basic Vitest setup is configured and passing; email verification doesn't land in spam; OAuth token refresh works correctly.

### Phase 2 — Profiles, Reputation & Entity Management
- `business_profiles`, `creator_profiles`, `creator_social_accounts`, `business_team_members`, `reviews`, `notifications`, `notification_preferences`, `admin_audit_logs` tables (RLS on).
- Dashboard shells (§14) with designed empty-state widgets.
- Public profile pages with niche tags, tier badges, and subscription plan badges.
- Review system with right-to-reply, reporting, and aggregate rating triggers (deferred/materialized view).
- Superadmin entity management + MFA enforcement.
- Test: cross-user RLS queries correctly fail; avatar/video upload round-trips through Storage; a new review recalculates the aggregate rating via trigger; admin MFA blocks unenrolled users (returns 403 with redirect to /admin/mfa-setup); team member login flows work.

### Phase 3 — Campaign Engine & Accountability
- `campaigns`, `applications`, `deliverables`, `campaign_templates`, `saved_campaigns` tables (RLS on).
- Campaign creation with drafts, budget caps, visibility modes, and templates.
- Marketplace search with filters + saved presets.
- Application state machine supporting multiple creators per campaign. Enforce UNIQUE(campaign_id, creator_id) and application rate limits.
- Lock-and-key UI with hashtag validation and bulk approval.
- Inngest: 24-hour grace period kick engine, 3-day SLA/3-strike for both creators and businesses.
- Campaign completed state: auto-set when all deliverables reach terminal state.
- Rating modal on every terminal state.
- Content moderation pipeline (Sightengine integration for v1; AWS Rekognition optional upgrade).
- Test: full state machine with two creators on one campaign, tracks stay independent; cron jobs fire correctly against advanced timestamps in staging; content moderation flags test NSFW content; concurrent application test (two creators clicking "Apply" within 50ms) only succeeds if slots allow.

### Phase 3.5 — Load Testing
- Run k6 or Artillery against the tracking edge function and conversion webhook.
- Simulate a viral campaign: 10,000 requests per second (RPS) sustained for 60 seconds.
- Test: Edge function TTFB <50ms at 10k RPS; webhook queue doesn't drop events; database connection pool doesn't exhaust; clicks_log partition creation keeps up with write volume.

### Phase 4 — Financial Routing (Stripe)
- Stripe Connect Express onboarding gated before applying. Handle `account.updated` webhooks to set `stripe_connect_ready`.
- Stripe Billing subscription setup (creator + business plans).
- Destination charges, 90/10 split, fee absorption.
- 7-day hold → auto-release/dispute logic, `ledger_entries`, `webhook_events` idempotency guard, webhooks.
- Partial refunds, chargeback handling, minimum payout threshold ($25).
- Weekly automatic payouts + monthly PDF invoice generation.
- Tax form blocking (W-9/W-8BEN/etc.).
- Dashboard earnings widgets go live with real numbers.
- Webhook retry + DLQ: Return non-2xx to trigger Stripe retry. After 5 failures, write to `failed_jobs` and alert via Sentry.
- Test: Stripe test-mode events for payment/transfer/refund/chargeback; subscription creation/upgrade/downgrade/cancel flows work; a held payout auto-releases after the (shortened, staging) hold window; the "haven't been paid" dispute stays disabled until `hold_expires_at` passes; partial refund correctly splits: e.g., $100 total, 2/3 deliverables approved → $66.67 to creator (minus 10% platform fee = $60.00), $33.33 refunded to business.

### Phase 5 — Edge Tracking Engine & Pixel
- Edge Function for the JWT redirect with HMAC verification and expiration enforcement.
- Pixel script (cookie drop + heartbeat + S2S fallback + consent gating).
- jti blocklist in Redis (AOF persistence) + Postgres `revoked_jtis` table.
- pg_cron: 12-hour pixel penalty (`0 */12 * * *`), domain-scoped, scoped to Affiliate/Hybrid.
- Checkout webhook → attribution → Phase 4 payout logic.
- `clicks_log` + fingerprinting + cross-device KPI surfacing.
- Upstash rate limiting on pixel pings and tracking redirects.
- Pixel installation helpers (GTM container template for v1; Shopify/WordPress documented as v2).
- Superadmin SLA Command Center and Fraud Feed go live.
- Test: a real click-to-purchase flow attributes correctly on a staging brand site; cookie Max-Age matches the attribution window exactly; a Fixed-only campaign launches with no pixel installed; revoked tracking link returns 410 Gone; expired JWT returns 410 Gone (not 302 redirect).

### Phase 5.5 — Security Audit
- Pen-test tracking JWT forgery attempts.
- RLS bypass attempts via raw SQL injection.
- Stripe webhook replay attacks using stripe-cli.
- Verify idempotency guards survive duplicate events.
- Test: All security tests pass; no RLS bypass found; webhook replay returns 200 OK without double-crediting.

### Phase 6 — Video, Chat & Polish
- Direct MP4 upload to Supabase Storage for v1 (max 50MB). FFmpeg/HLS/Mux is v2.
- `messages` table + Supabase Realtime chat (with PII filtering + spam detection).
- Notification preferences (mute per type) via `notification_preferences`.
- Dynamic OG images for public campaign and creator profile pages.
- Implement SEO metadata, sitemaps, and OpenGraph tags for all public marketing/profile pages.
- Full end-to-end regression across every route and role.
- Test: upload → playback on a throttled connection; realtime chat delivers instantly across two sessions; PII regex masks emails/phones/external URLs; spam detection flags repetitive messages; smoke-test every page as creator, business, and admin.

### Phase 7 — Launch Readiness
- SEO audit (sitemap, robots.txt, meta tags, structured data, Core Web Vitals).
- Legal review (MSA, Privacy Policy, Cookie Policy, DPA).
- Performance budget enforcement: Lighthouse >90 on mobile AND desktop for all marketing pages, <200ms TTFB on dashboard, <2s LCP.
- Stripe production keys + livemode webhook switch.
- Creator launch program: manually onboard 20 creators before public launch.
- Status page setup (Instatus free tier).
- Community/Discord server for approved creators.
- Test: Lighthouse CI passes on every page; legal docs reviewed by counsel; 20 creators complete full onboarding flow without friction (average time <5 minutes; zero drop-offs at Stripe Connect step; all 20 pass tier verification).

---

## 19. Operational Runbook & Infrastructure

### 19.1 On-Call & Incident Response
- Severity definitions:
  - **SEV1:** Payments down, creators cannot withdraw, Stripe webhooks failing. Response: page on-call engineer within 15 minutes.
  - **SEV2:** Pixel offline for >50% of businesses, SLA timers not firing, authentication down. Response: within 1 hour.
  - **SEV3:** UI bug, non-critical feature broken, analytics delay. Response: next business day.
- Escalation: SEV1 auto-escalates to tech lead after 30 minutes, to CTO after 1 hour.
- Communication templates: Pre-written status page updates and user emails for common outages (payments, pixel, auth).

### 19.2 Backup & Disaster Recovery
- Daily automated backups: Supabase provides daily backups. Verify they are enabled and test restoration monthly.
- Point-in-time recovery (PITR): Enabled on production database. 7-day retention minimum.
- Cross-region backup replication: Replicate critical backups to a secondary region (e.g., EU if primary is US).
- RTO/RPO targets: Recovery Time Objective <1 hour. Recovery Point Objective <15 minutes.
- Cold storage: Monthly partitions of `clicks_log` older than 90 days are exported to S3 Glacier Instant Retrieval and dropped from Postgres. Retention: 2 years for analytics, then deleted.
- Rollback procedures:
  - Bad migration: Run `supabase migration repair` to mark as reverted, then deploy down script.
  - Bad deploy: Vercel instant rollback to previous production deployment.
  - Bad Stripe webhook handling: Disable webhook endpoint in Stripe Dashboard, fix code, re-enable.

### 19.3 API Versioning & Error Codes
- Public API versioning: All public/external routes under `/api/v1/...`. Internal dashboard APIs under `/api/internal/...`. Webhooks under `/api/webhooks/`. Deprecation policy: 6 months notice before v1 sunset.
- Error code taxonomy:
  - `400` — Bad Request (validation failure)
  - `401` — Unauthorized (not logged in)
  - `403` — Forbidden (logged in but insufficient permissions / RLS denied)
  - `404` — Not Found
  - `409` — Conflict (duplicate application, concurrent edit)
  - `422` — Unprocessable Entity (business logic violation, e.g., applying to own campaign)
  - `429` — Rate Limited
  - `500` — Internal Server Error
  - `502` — Bad Gateway (upstream service failure, e.g., Stripe timeout)
  - `503` — Service Unavailable (maintenance mode)
- Pagination: Cursor-based (keyset) pagination for all list endpoints (campaigns, messages, conversions, clicks_log). OFFSET pagination is prohibited for tables >10,000 rows.
- Webhook payload schemas: Documented in `docs/api/webhooks.md` with example payloads for Stripe, Supabase Storage, and S2S conversion events.

### 19.4 Customer Support
- In-app help widget: Crisp or Intercom embedded on all dashboard pages. Free plan: email support only (24h response). Paid plans: live chat during business hours.
- Support email: support@adswish.com (Resend routing).
- Response time SLAs: Free: 24 hours. Pro/Growth: 4 hours. Premium/Enterprise: 1 hour.
- Email deliverability: Configure SPF, DKIM, and DMARC for the sending domain (adswish.com) before sending transactional emails. Verify domain in Resend dashboard.
- Knowledge base: Self-service articles linked from the help widget. Hosted on the marketing site at /help.

### 19.5 Feature Flags
- PostHog feature flags used for:
  - Gradual rollout of new dashboard widgets (10% → 50% → 100%)
  - A/B testing landing page copy and CTA colors
  - Gating experimental features (e.g., AI-powered campaign recommendations — OFF by default per §2)
- A/B test guardrails: Minimum 100 participants per variant and 2-week run duration before conclusions. Track primary metric (conversion rate) and guardrail metrics (page load time, error rate). Kill switch: Any variant with error rate >2% above baseline is auto-disabled.
- All feature flags must have a kill switch accessible to admins. If a flagged feature causes errors, disable within 60 seconds.

---

## Appendix A — Visual Reference: What Everything Looks Like

dropship.io is the standing design example for the entire product. Wherever this document doesn't pin down a visual detail for any surface — landing, dashboards, marketplace, auth pages, superadmin — build it the way dropship.io would build it: white/paper background, one blue accent doing the work, cards with 16px radii and hairline borders, numbers in mono, proof (real data) over decoration, and generous whitespace. The screenshots provided in `docs/screenshots/` are the visual source of truth.

### A.1 The reference — dropship.io
- **The hero pattern.** White page, light-blue announcement banner above the nav, logo left, quiet text links, one filled blue CTA. Big bold headline with a single accented phrase, short gray subhead, two buttons (one filled, one outlined). Then the signature move: a horizontally scrolling strip of product cards with real numbers right under the headline — proof before pitch. Adswish's equivalent is the campaign strip.
- **The tools pattern.** Capabilities presented as named products — icon in a light-blue glass badge, product name, one-line description, "View product" link. Adswish's tool grid copies this shape exactly: nine named tools, 3×3 grid, each with its own icon badge.
- **The content-card pattern.** Image block on top, metadata eyebrow, bold title, gray one-liner, blue "Read article" link. The Adswish Guides section uses this shape for its three guide cards.

### A.2 The build — Adswish landing page
- **Hero + campaign strip.** Announcement bar ("Adswish 1.0 is live"), nav with the blue checkmark logo, headline with the italic blue accent phrase, filled "Start a Campaign" + outlined "Join as a Creator" CTAs, and the horizontally scrolling campaign cards below. Cards labeled "Example campaigns."
- **Tool grid.** The light-gray section with the 3×3 grid of white tool cards — blue icon tile, tool name, one-line description, hover lift.
- **Perks + attribution deep-dive.** Perks cards with round icon badges and checkmark bullet lists, and beside the pixel copy: the dark code-editor panel showing the `<script src="https://adswish.com/pixel.js?id=BUS_123">` tag, the `adswish.track(...)` conversion call, and the green attribution result line.
- **Guides + dark footer CTA.** Guide cards in the dropship blog-card shape, then the dark ink panel with radial blue glow: "Launch your first campaign today," two buttons, closing the page before the footer link columns.

**Note on colors:** Treat dropship.io screenshots as the source of truth for layout and structure; the final color pass moves accents to Affiliate blue `#3A5CE0`, payment badges to amber/blue/violet per §4, headings to Bricolage Grotesque, and numerals to IBM Plex Mono.

### A.3 Everything else — dropship.io as the example

The same visual language extends past the landing page. Whenever a new surface is built and this document doesn't specify its look, match the corresponding dropship.io screen:
- **Auth pages (login/signup):** centered white card on paper background, logo on top, one input per line, filled blue submit, quiet "switch role" link. Both checkboxes (MSA and Privacy Policy) sit directly above the submit button, unchecked by default.
- **Marketplace / Discover:** dropship's Product Database shape — a filter rail on the left (payment type, commission %, rating, attribution window, niche), dense result cards on the right, each card carrying its payment-type color coding and terms line, plus "save this filter" presets.
- **Dashboards (§14):** dropship's Sales Tracker shape — big mono numbers in widget cards, today/7-day/30-day toggle, a line chart for conversions over time, ranked lists beneath. Business campaign cards carry applicant/pending-approval counts and pixel status.
- **Superadmin:** the dark variant — ink `#12141C` base, same card grid, ledger and SLA queue as number-forward widgets, dispute tickets expanding into evidence drawers.
- **Footer, emails, error/empty states:** white surface, hairline borders, one blue action per state, copy in the same short-and-concrete voice as the landing page.

### A.4 Pattern mapping, dropship.io → Adswish

| dropship.io | Adswish equivalent |
|---|---|
| Announcement banner ("Dropship 2.0 is live!") | "Adswish 1.0 is live" banner above the nav |
| Hero headline with accented phrase | "Discover creators who actually sell" |
| Product-card marquee with revenue figures | Campaign strip with "CREATORS EARNED" figures (labeled "Example campaigns") |
| Named tool tiles ("Sales Tracker", "Shop Library"…) | Nine named tools in the 3×3 grid |
| Chrome extension promo section | Pixel promo ("One line of code. Total attribution.") — no extension exists in Adswish |
| Blog article cards | Guides cards (creator / business / engineering) |
| Big footer CTA ("Ready to begin?") | Dark CTA panel ("Launch your first campaign today") |
| Sales Tracker time-range toggle | Today/7-day/30-day toggle on earnings widgets |
| Product Database filters + saved presets | Marketplace filters + reusable filter presets |
| Store top-products ranking | Creators ranked per campaign in the detail view |
| Dark footer CTA + link columns | Dark CTA panel + four-column footer |

---

## 20. Technical Addendum & Architecture Specifications

This addendum defines the exact execution rules and implementation specifications for the edge cases identified during architecture review. The agent must adhere to these constraints strictly to prevent data corruption, financial discrepancies, and security vulnerabilities.

### 20.1 Financial Math, Stripe Fee Allocation, Refunds & Subscriptions
- Commission & Fee Absorption: The platform absorbs all underlying payment processing fees (e.g., Stripe's 2.9% + 30¢) entirely out of its 10% platform take. Creators always receive an exact, unreduced 90% net payout.
- Stripe Connect Destination Charges:
  - When charging for a milestone or conversion, initiate a Destination Charge pointing to the creator's connected Express account:
  - `transfer_data.amount = round(total_amount * 0.90)` (round to nearest integer cent; if exactly 0.5¢, round down to avoid overpaying the creator beyond 90%)
  - `application_fee_amount = total_amount - transfer_data.amount`
  - Configure the platform account as the settlement merchant for transaction fees so processing deductions are debited from the platform's balance, not the creator's transfer.
  - Enable Stripe Connect account debits in platform settings to allow clawbacks.
- Refund & Clawback Logic: If a business refunds a customer after the 7-day hold has auto-released, the platform must claw back the creator's 90% cut. Instruct the Stripe webhook to check the creator's Connect balance. If insufficient, Stripe debits the platform account for the shortfall. The creator's account is flagged and future earnings are garnished at 50% per payout until the platform is made whole. If the shortfall exceeds $500, flag for admin review and suspend the creator from new applications. Do not allow the creator to apply to new campaigns until the balance is positive. Express accounts cannot go negative — the platform absorbs the shortfall, not the creator.
- Currency Conversion: If a business pays in EUR and the creator's Connect account is USD, Stripe converts automatically (extra ~1%). The platform absorbs this to keep the 90% promise clean.
- Tax Compliance: Creators must complete Stripe Connect Express tax forms appropriate to their jurisdiction (W-9 for US, W-8BEN for non-US, etc.) during onboarding. Block payouts if tax information is missing or invalid. Businesses need tax invoices too — integrate Stripe Tax for automatic tax calculation on the 10% platform fee AND subscription fees. Stripe Tax must be activated in the Stripe Dashboard and tax categories configured before processing live transactions.
- Subscription Revenue Recognition: Subscription fees are recognized as revenue at the start of each billing period. Failed subscription payments trigger a 7-day grace period before downgrading to Free. Webhook: `invoice.payment_failed` → flag account → send dunning email → downgrade after 7 days if unresolved.

### 20.2 Background Job Architecture & Video Processing
- Execution Engine: Use Inngest (generous free tier, natively supports Next.js App Router and Edge/Serverless) to orchestrate long-running asynchronous workflows without hitting Vercel's standard serverless timeout limits. Inngest is the sole background job system for v1.
- Video Uploads (v1): Direct MP4 upload to Supabase Storage, served via native `<video>` element with `preload="metadata"`. Max 50MB, 1080p. Server-generated signed upload URL required — reject unauthorized direct uploads.
- Failed Job Retry Logic: Exponential backoff (1h, 2h, 4h, 8h). Max 4 retries. After 4 failures, alert admin and require manual intervention. Store failed job metadata in the `failed_jobs` table for debugging.
- Virus Scanning: Scan all uploads with a cloud scanner (Cloudmersive Virus API for v1) before processing. Reject infected files at the upload step. ClamAV is the self-hosted upgrade path.

### 20.3 Strict Social OAuth & Follower Verification
- Direct Platform APIs: Implement official OAuth 2.0 authentication flows for:
  - TikTok: TikTok for Developers (Login Kit & Display API) to read follower metrics. Apply for app review 4–6 weeks before launch. Use manual verification fallback until approved.
  - Instagram: Meta for Developers (Instagram Graph API) with `pages_read_engagement` and `instagram_basic` permissions. The Creator API is deprecated — do not use it.
  - YouTube: Google Cloud Console (YouTube Data API v3 `channels.list` with `statistics` part).
- Token Refresh Strategy: Store `refresh_token` and `refresh_token_expires_at` and schedule refresh jobs before expiry. Handle expired tokens gracefully in the monthly follower re-check job.
- Token Refresh Failure: If a scheduled refresh fails (e.g., user revoked access), send 3 escalating emails over 7 days. If unresolved, mark the social account as disconnected but do NOT affect active campaigns. Block new applications until reconnected.
- Rate Limit Handling: TikTok/Meta APIs are heavily rate-limited. Implement exponential backoff and queue follower count checks. Never hit APIs in hot paths.
- Threshold Gate: Read the authenticated `follower_count` / `subscriber_count` from the platform payload. Assign tier per §5. Creators must connect at least one account AND that account must have ≥1,000 followers. Block onboarding progression if no account meets the Micro tier minimum.
- Fallback Queue: Implement the secondary manual verification table (`manual_follower_verifications`) with screenshot upload and admin review dashboard as an active fallback when third-party OAuth apps are pending production verification.

### 20.4 Precision Task Scheduling & 24-Hour Grace Period Engine
- Event-Driven Scheduling: Use Inngest Step Sleep/Schedule to trigger precise event executions instead of periodic database polling.
- Deliverable State Machine & Deadline Flow:
  1. If a creator submits a URL before the deadline passes, the slot status transitions to `pending_business_review`. The grace period logic does not apply to these slots.
  2. When a deliverable deadline passes and `submitted_url` is still NULL, schedule an automated warning dispatch event and queue a delayed task scheduled for `deadline_date AT TIME ZONE 'UTC' + INTERVAL '24 hours'` (Status: `grace_period`).
  3. When the delayed task executes, check `deliverables.submitted_url`:
     - If still NULL: execute creator removal, reset slot availability, issue terminal review trigger, and send cancellation webhooks (Status: `kicked`).
     - If submitted within the window: cancel kick execution and transition slot to `pending_business_review`.
  4. If a deadline extension is negotiated via chat, update `extended_deadline_at` and reschedule the grace period task. Call Inngest's cancel API with the stored `grace_period_task_id` to cancel the old task, then reschedule.
- Idempotency Keys for Delayed Jobs: Use `deliverable_id` as the idempotency key. If Inngest retries a kick job, it must not double-remove a creator.
- Reconciliation Cron: Maintain an hourly pg_cron reconciliation sweep as a fallback to catch any delayed webhooks or interrupted tasks.

### 20.5 Database Migrations, Triggers & Schema Versioning
- Supabase CLI Workflow: All table definitions, RLS policies, functions, and triggers must be managed using version-controlled migration files via the Supabase CLI (`supabase migration new <name>`).
- Execution Rule: Direct manual changes via the Supabase dashboard SQL editor are strictly prohibited during development. Every schema modification must have a corresponding rollback-safe migration script stored in the repository.
- Zero-Downtime Migrations: Use expand/contract pattern. Add new columns/tables in one deploy, dual-write in application code, backfill in background job, switch reads in next deploy, drop old columns in final deploy. Never drop columns or constraints in the same deploy that removes application dependencies on them.
- Migration Rollback Testing: Every migration must have a down script tested in CI against a fresh copy of the database.
- Seed Scripts: Maintain `supabase/seed.sql` with realistic test data so developers aren't manually creating campaigns.
- Aggregate Rating Caching: Calculating `average_rating` on the fly via joins under RLS will kill database performance. Use a deferred trigger or materialized view refreshed every 5 minutes via pg_cron, rather than a synchronous row update. Synchronous triggers are acceptable for v1 only if wrapped in advisory locks.
- Analytics Materialization: To support the today/7-day/30-day dashboard toggles without timing out under RLS, implement a `daily_conversion_rollups` table. Create a pg_cron job that runs at midnight UTC to aggregate the previous day's `clicks_log` and `conversions` data into this table. Dashboard queries must hit this rollup table, not the raw transactional tables. Partition `daily_conversion_rollups` monthly; auto-create partitions via pg_cron on the 25th of each month for the upcoming month.
- Soft Deletes: Add `deleted_at` timestamp to `campaigns`, `business_profiles`, `creator_profiles`, `creator_social_accounts`, `campaign_templates`, and `reviews`. Hard deletes destroy audit trails and financial referential integrity.
- Message Encryption: Use the pgcrypto extension to encrypt `messages.body` at rest. Encryption key stored in Supabase Vault (or environment variable `MESSAGE_ENCRYPTION_KEY`). AES-256-CBC via pgcrypto's `pgp_sym_encrypt()`. Key rotation is a documented v2 operational runbook item, not an automated 90-day requirement for v1. RLS + TLS provides sufficient protection for v1.
- Pagination: Cursor-based (keyset) pagination for all list endpoints. OFFSET pagination is prohibited for tables >10,000 rows.

### 20.6 Stripe Webhook Signature Verification & Idempotency
- Secure Verification: All incoming Stripe webhooks must validate the `stripe-signature` header using the raw request body buffer before processing any payload data.
- Webhook Endpoint Versioning: Pin to a specific Stripe API version in the webhook endpoint config to prevent breaking changes when Stripe updates.
- Idempotency Guard: Maintain a dedicated `webhook_events` table logging processed Stripe event IDs. Before executing state changes (e.g., updating payout holds or balances), check if the `event_id` already exists. If it does, return an immediate 200 OK acknowledgment to prevent duplicate handling or double-crediting during Stripe retry attempts.
- Webhook Retry & Dead Letter Queue: Return non-2xx status to trigger Stripe retry with exponential backoff. After 5 failures, write to `failed_jobs` table and alert via Sentry. Manual replay via admin dashboard for S2S webhooks.
- Local Development: Use stripe-cli locally to forward webhooks to `localhost:3000/api/webhooks/stripe` during development.

### 20.7 Typography & Font Stack Implementation
- Design Token Compliance: Configure `tailwind.config.js` and global stylesheet layers to explicitly bind typography classes:
  - Headings: Bricolage Grotesque
  - Body Text: Inter
  - Financial Metrics / Codes / Numbers: IBM Plex Mono
- Font Subsetting: Use next/font with `subsets: ['latin']` and explicit weight arrays to avoid shipping 400KB of unused font glyphs.
- Hydration Safeguard: Ensure custom font families are properly imported and loaded at the root layout level (`app/layout.tsx`) using next/font to prevent layout shifts or visual jitter across data-dense numeric components.

### 20.8 GDPR / Data Privacy & Server-to-Server (S2S) Tracking
- Consent-Gated Pixel Initialization: The tracking pixel script must check for explicit user consent before dropping the first-party tracking cookie (Max-Age scoped to the campaign's attribution window). It must respect standard consent management platforms (CMPs) or evaluate standard consent flags (e.g., checking `window.Cookiebot` or global consent hooks).
- Consent Logging: When a user grants cookie consent, log the consent record (timestamp, consent version, IP hash) to a `consent_logs` table for GDPR audit trails.
- Server-to-Server (S2S) Fallback: Because GDPR consent can block the first-party cookie, the business's backend should capture and store the `adswish_ref` JWT server-side when the user initially lands on the business's site with the tracking parameter. At checkout, the backend POSTs the conversion to `/api/v1/webhooks/conversion` using this stored JWT. This ensures attribution survives even if the pixel script is blocked by consent management. The business backend CANNOT read the user's localStorage/sessionStorage from a server-side webhook — localStorage is origin-scoped and inaccessible across domains.

### 20.9 JWT Token Expiration & Replay Protection for Tracking Redirects
- Expiration Enforcement: Every tracking JWT generated at the edge must include a strict `exp` claim aligned with the campaign's active attribution window, capped at 24 hours for click handoffs.
- Instant Validation: The Next.js Edge Function handling `adswish.com/t/...` must cryptographically verify the HMAC signature against `JWT_SIGNING_SECRET` and validate expiration constraints before issuing the HTTP 302 redirect.
- Token Rotation & Blocklist: If a creator regenerates their tracking link (e.g., they leaked it), old JWTs must be invalidated. Maintain a `revoked_jtis` table in Postgres as the source of truth. Cache active revocations in Redis with AOF persistence for fast lookups. The Edge Function checks Redis first (fast path), falls back to Postgres on cache miss.

### 20.10 Database Concurrency & Race Conditions on Deliverable Slots
- Atomic Transactions: Prevent over-allocation during simultaneous application or slot acceptance bursts by executing operations within Supabase Postgres RPC functions or transactions.
- Row Locking: Utilize explicit Row-Level Locking (`SELECT ... FOR UPDATE`) when querying available campaign slots or applicant queues to guarantee strict concurrency safety.
- Budget Cap Atomic Enforcement: Use a Postgres trigger that rejects conversions exceeding `campaigns.budget_cap`, or use `SELECT ... FOR UPDATE` on the campaigns row when inserting a conversion. Prefer the trigger for atomicity.
- Optimistic Locking on Campaign Edits: If two admins edit a campaign simultaneously, last-write-wins could corrupt terms. Use a version column or `updated_at` check to reject stale writes.
- Concurrent Application Testing: Test concurrent application scenarios in Playwright: two creators clicking "Apply" on the same campaign within 50ms of each other. Only one should succeed if slots are limited.

### 20.11 Secure Signed Upload URLs for Raw Video & Logo Assets
- Server-Brokered Uploads: Unauthorized direct uploads to Supabase Storage buckets are prohibited. All asset uploads must be authorized and generated via a Next.js Server Action or secure API route.
- Constraint Validation: The server must verify active user sessions and campaign permissions before issuing time-limited Signed Upload URLs enforcing strict MIME-type and file-size limits.
- Video Constraints (v1): Max 50MB, 1080p MP4. Reject files exceeding these limits before they hit Supabase Storage.
- Virus Scanning: Scan all uploads with a cloud scanner (Cloudmersive Virus API for v1) before processing. Reject infected files before they hit Supabase Storage.

### 20.12 Platform Integrity & PII Filtering
- Fee-Bypass Prevention: Filter PII at the application layer (Next.js API route) before writing to the database. Detect and mask Personally Identifiable Information (emails, phone numbers, and non-platform URLs) in the `messages` table. Platform handles (TikTok, Instagram, YouTube) and Adswish campaign/deliverable URLs are whitelisted. Mask detected PII with `[REDACTED]` and log the attempt to `admin_audit_logs` for review. This prevents creators and businesses from bypassing the platform to avoid the 10% commission.
- Spam Detection: Beyond PII filtering, detect repetitive messages, all-caps shouting, and external link attempts in chat. Rate-limit to 1 message per 30 seconds per user.
- In-App Notifications: Create a `notifications` table. All system events (new applicant, pixel offline, payment released, SLA warning) must insert a row into this table. The frontend UI must render a bell-icon dropdown reading unread notifications for the authenticated user.
- Notification Preferences: Users must be able to mute email/push per notification type. Use a separate `notification_preferences` table with `user_id PRIMARY KEY`, `muted_types TEXT[]`, `email_enabled BOOLEAN DEFAULT true`, `push_enabled BOOLEAN DEFAULT true`.

### 20.13 Superadmin Audit Logging
- Admin Audit Logs: A superadmin has the power to force-release funds, ban users, and manually resolve disputes. This is a massive security risk. Create an `admin_audit_logs` table. Every superadmin action must write to this table recording `admin_id`, `action_type` (force_release|refund|ban_user|unban_user|resolve_dispute|manual_strike|override_rating), `target_entity_id`, `metadata` (JSONB), and `created_at`. No destructive or financial action may execute without a corresponding log entry.
- Immutable Logs: Write admin audit logs to WORM storage (S3 Object Lock in Governance mode with 7-year retention) or a separate audit database. If an admin is compromised, they shouldn't be able to delete their own tracks.
- MFA Enforcement: Require TOTP (e.g., via Supabase Auth MFA) for all admin accounts before any admin route is accessible. Enforce at the middleware layer: middleware verifies `user.app_metadata.role = 'admin'` AND `session.aal === 'aal2'`. Both must be true.
