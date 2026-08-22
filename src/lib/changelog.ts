export type ChangelogEntry = {
  version: string;
  date: string; // ISO date
  title: string;
  highlights: string[];
  fixes?: string[];
};

/**
 * Single source of truth for the public changelog. The `/legal/changelog`
 * page and the downloadable PDF both render from this list, so the two can
 * never drift apart.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "v3.5.0",
    date: "2026-08-22",
    title: "SocialVerify — independent social-account verification",
    highlights: [
      "SocialVerify campaign flow: select any combination of YouTube, TikTok, Instagram, and Twitter/X, and the campaign stays locked until every selected platform is verified.",
      "Cryptographic verification tokens: each platform gets an HMAC-signed token with a 7-day expiry, a countdown, and auto-rotation — post it to your bio to prove ownership.",
      "No-API authenticity scoring on a 100-point scale (engagement rate, comment quality, posting consistency, growth velocity, cross-platform, plus a challenge bonus) from public post data or signed self-reported metrics — no privileged platform API keys required.",
      "Seven-proof identity binding to stop impersonation: domain ownership, bi-directional links, time-delayed token persistence, video proof, a two-way handshake, historical content, and social-graph analysis, combined into a confidence score.",
      "Signed domain manifest at /.well-known/social-verification.json — a cryptographically signed, public record of your verified accounts that anyone can audit independently.",
      "Full audit with weighted scoring (signature, token match, authenticity, cross-platform) and an immutable audit log.",
      "A five-step business dashboard (Select Platforms → Tokens → Identity → Audit → Authenticity) with a lock banner, monospace token cards, proof-of-identity cards, and a circular score ring.",
      "Creator tiers now follow a clean 10× ladder — Small 10K, Moderate 100K, Big 1M — applied consistently across onboarding, eligibility, the marketplace, and SocialVerify platform minimums.",
      "Creator onboarding Step 2 now shows the per-account proof-of-ownership code and the exact steps to verify (paste the code in your bio → screenshot → admin review), so new creators can prove ownership before they even finish signing up.",
    ],
  },
  {
    version: "v3.4.0",
    date: "2026-08-21",
    title: "Platform hardening, account deletion, and campaign assets",
    highlights: [
      "Self-service account deletion from Settings → Danger zone: creators are blocked while they have pending-hold earnings, businesses while a pre-paid balance remains, and completed deletions GDPR-anonymise reviews (identity redacted, rating + date retained) before removing the account.",
      "Campaign asset upload: businesses can now attach a preview image or video to a campaign (JPEG/PNG/WebP/GIF/MP4/WebM, max 25MB) via a new campaign-assets storage bucket.",
      "Cursor (keyset) pagination for the creator campaign feed — stable ordering with no skips or duplicates as new campaigns are posted, with a next_cursor for loading more.",
      "Monthly partition maintenance replaced the stub cron: a dynamic SQL function now creates the next 3 months of partitions for clicks_log and daily_conversion_rollups on the 25th, safely and idempotently.",
      "UptimeRobot third-party uptime check is now wired: the Tracking page’s third tick activates once UPTIME_ROBOT_API_KEY is set and the verified domain is monitored.",
      "Follower re-check worker: a monthly cron re-fetches each connected social account's live follower count, recomputes the creator's tier, and refreshes badges — gracefully skipping any platform whose API keys aren't configured yet.",
      "Team seats lifecycle: business owners can invite teammates by email (with plan seat-limit enforcement), invitees accept or decline, and owners can remove members — and the owner is notified in-app the moment a teammate accepts or declines.",
      "Team invitations now send a branded email with a one-click accept link, and brand-new invitees get a password-set link so they can log in with a password right away.",
      "Campaign preview upload button added to the campaign editor — pick a local image or video and it's stored on the new campaign-assets bucket when the campaign is saved.",
      "Google sign-in is now admin-controlled: it stays blurred as Coming soon on login and sign-up until a superadmin flips it live from the Superadmin dashboard — to be done only after the Google Cloud OAuth redirect URI is registered.",
      "Admin account management: the Superadmin user directory now shows each account's plan and payments state, with actions to cancel plans, pause/resume payments, and terminate accounts (cancel plan + ban + pause payouts) — all audit logged, and payout/charge jobs skip paused accounts.",
      "Notifications no longer auto-mark everything read on open — each row has its own Mark read action plus a Mark all read button.",
      "Admin cancel-plan and terminate can now also cancel the underlying Stripe subscription (behind a second explicit confirmation so billing only stops when intended), and canceled plans can be resumed — restoring features and, with confirmation, reactivating a period-end-canceled Stripe subscription.",
      "Paused-payment accounts now see a banner on every dashboard page (rendered by the shared shell), not just the overview.",
      "TikTok Connect entry points were removed in favor of Instagram/YouTube Connect plus manual screenshot verification (admin-approved), so creators can still get verified and tiered without TikTok's domain-verification requirement.",
      "YouTube follower counts can now be looked up with a plain API key instead of OAuth: the monthly follower re-check resolves a channel by handle via the YouTube Data API, so YouTube verification works without the Google consent screen.",
      "Self-serve YouTube verification now proves ownership before auto-verifying: paste your channel handle and we ask you to add a one-time per-account code to your channel About, then confirm the live description contains it — no OAuth, no screenshot, no admin, and nobody can claim a channel they don't control. Available in the dashboard and during onboarding.",
      "Admin follower-screenshot approval now cross-checks a YouTube claim against a live API lookup at approval time, so the verified count is the real subscriber count rather than the self-reported one.",
      "The manual verification form now states explicitly that a self-typed follower count is never auto-verified — it always requires a screenshot and admin review (or a YouTube ownership code), closing the impersonation gap.",
      "Twitter/X added as a fourth verification platform — token-in-bio + screenshot + admin review with no privileged API, following the existing follower-tier system.",
      "Every manual screenshot verification now issues a per-account proof-of-ownership code: creators post it to their bio and show it in the screenshot, and admins see the expected code so they can confirm the account is real rather than a copy.",
      "Public verification report: each approval writes an immutable, publicly-readable audit entry — a shareable page at /audit/:creatorId and a no-auth JSON API at /api/v1/audit/creator/:id showing platform, handle, snapshotted follower count, threshold met, and ownership-token match.",
    ],
    fixes: [
      "Fixed password + authenticator login failing with a Bearer-token error: the 2FA challenge now reuses the client that completed the password/OTP step instead of a fresh sessionless client.",
    ],
  },
  {
    version: "v3.3.0",
    date: "2026-08-20",
    title: "Integration hub upgrade, branded email, and two-factor authentication",
    highlights: [
      "Integration hub now shows real brand logos for every app (Stripe, Resend, Supabase, Upstash, Sightengine, Google Ads, Meta, TikTok, YouTube, Instagram, X, LinkedIn, Pinterest, Snapchat).",
      "Add / Remove integrations: press the green Add button to reserve a slot (counts toward your plan limit), then the card flips to a green Added state with a red Remove button. Changes are saved to your account, not just your browser.",
      "Two-factor authentication (TOTP): enable 2FA from Settings → Security & 2FA with any authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password). Accounts with 2FA enabled must enter a 6-digit code at login.",
      "2FA at sign-up: brand-new accounts are offered authenticator setup right after creating their account — scan the QR code (or enter the secret manually) and verify one code to enable it before onboarding. Optional and skippable; you can always turn it on later from Settings.",
      "Creator profiles upgraded: @handle in the header, rating shows the review count, reviews show the business, campaign, and relative time, a public Campaign History section lists completed and active work, and the friend button gains Added / Copy Username / Message actions.",
      "Verification badges now match spec: blue = paid plan + at least one verified social account; gold = Premium plan + 1M+ followers on a verified platform.",
      "QR-code sign-up and sign-in fallback: if the confirmation or one-time email never arrives, scan a QR code with any authenticator app and create your account (or log in) with the 6-digit code — no email needed.",
      "Business profiles upgraded to match creators: Verified/Gold badges, the verified domain in the header, a Connected channels panel, Recent Reviews showing the creator, campaign, and relative time, and a real Campaign History — plus ℹ️ hover tooltips on every profile section explaining what it does.",
      "Microsoft (Azure AD) sign-in button added to login and sign-up — it lights up as soon as the admin enables the provider in Supabase Auth.",
      "Landing page gained an Integrations section showing every supported platform with its real logo.",
      "Single-session enforcement: only one active login per account — if another device or tab signs in, the older session is instantly kicked to a Session Ended screen with the masked email and a Contact Support button. Prevents account sharing and unauthorised access.",
      "Custom SMTP configured: verification, reset, and OTP emails now send through Resend from an Adswish-branded address (onboarding@adswish.com) once the domain DNS is verified.",
      "Dark mode and custom appearance settings now reset on logout and are only applied on dashboard pages — the landing page, login, and signup always render in the default light theme.",
      "Email rate limits raised for launch (confirmation/OTP/reset emails: 2 to 30 per hour per IP).",
    ],
  },
  {
    version: "v3.2.0",
    date: "2026-08-20",
    title: "A/B ad assets, Google Partner credits, and email-link fixes",
    highlights: [
      "A/B thumbnail assets: three frames auto-extracted from approved creator videos (10% / 50% / 90%), pick the winner for your ad creative.",
      "Google Partner credits: apply for the £500 first-campaign credit straight from the Google Ads dashboard.",
      "Blended ROAS dashboard: organic revenue (via your tracking links) and paid revenue side by side, revenue-by-source breakdown, and a 30-day organic series.",
      "Email links fixed: confirmation links opened in a different browser or device now verify your email automatically instead of failing with a PKCE error.",
      "Forgot-password flow: reset links land on a new set-a-new-password page.",
      "Supabase auth config corrected: site URL pointed at the live domain and the redirect allowlist now covers localhost and the production domain.",
    ],
  },
  {
    version: "v3.1.0",
    date: "2026-08-20",
    title: "Google Ads amplification, verification badges, and session security",
    highlights: [
      "Google Ads integration: OAuth connect flow, campaign drafts and launches, pause/resume/inject controls, and a budget-protection auto-kill switch.",
      "Blended Google Ads analytics view with spend, revenue, conversions, ROAS, and per-campaign charts.",
      "Creator verification badges: blue badge for paid plans, gold badge for 1M+ followers on a verified platform.",
      "Google sign-in now marks new accounts email-verified so OAuth signups skip the confirmation step; the verify-email page gained a resend button.",
      "Session security: configurable inactivity timeout and back-button auto-logout with a clear \u201csession has timed out\u201d message.",
      "Plan-based payout holds (Free 7 days, Pro 5, Premium 3) applied to conversion escrow.",
      "Landing page rebuilt as v3 with How It Works, Guides, and live-campaign gating; Creator Marketplace demo section removed.",
      "Terms, Privacy, and Subprocessors updated for Google Ads integration, OAuth data handling, and session policy.",
    ],
  },
  {
    version: "v3.0.0",
    date: "2026-08-20",
    title: "Integrations hub, plan alignment, and security hardening",
    highlights: [
      "New Integrations hub with per-plan connection limits (6 / 10 / 20) and five locked core integrations.",
      "Plan campaign limits aligned across the dashboard, plan page, and enforcement layer (Growth 10, Enterprise 25, Creator Premium 25).",
      "Public Changelog added under Legal, with a downloadable PDF of every release.",
      "Fixed the notification-settings navigation bug caused by an over-aggressive leave-site prompt.",
      "Signed-in header now shows your plan tier and role (Business or Creator).",
    ],
    fixes: [
      "Removed the native beforeunload dialog that interrupted internal dashboard navigation.",
    ],
  },
  {
    version: "v2.2.0",
    date: "2026-08-19",
    title: "Blueprint audit, currency alignment, and data controls",
    highlights: [
      "Closed the safest blueprint gaps: creator eligibility checks, active-plan limit enforcement, and real daily analytics rollup.",
      "GDPR data export added to Settings.",
      "Payout invoices made private, with creator-scoped signed PDF downloads.",
      "Failed weekly payouts remain retryable instead of being incorrectly marked paid.",
      "Admin SLA actions and manual-strike controls added, all audit-logged.",
      "Live-facing currency displays and new database defaults aligned to GBP.",
    ],
  },
  {
    version: "v2.1.0",
    date: "2026-08-19",
    title: "Admin controls, manual verification, and deploy health",
    highlights: [
      "Admin account suspension, banning, and manual follower-screenshot verification.",
      "Fixed the admin MFA redirect loop so the authenticator code screen loads.",
      "Deploy health check and production regression sweep tooling.",
      "Directory pages now show friendly empty states instead of blank grids.",
    ],
  },
  {
    version: "v2.0.0",
    date: "2026-08-19",
    title: "Creator marketplace, plans, balances, and analytics",
    highlights: [
      "Creator marketplace with tier badges, verified channels, and niche filters.",
      "Subscription plans for businesses (Free / Growth / Enterprise) and creators (Free / Pro / Premium).",
      "Business balance system with top-up and 90/10 cash-out.",
      "Connections (friends), campaign invites, and real-time campaign chat.",
      "Analytics dashboards, appearance themes, and Google/TikTok/Instagram social connections.",
    ],
  },
];
