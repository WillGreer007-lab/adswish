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
      "Custom SMTP configured: verification, reset, and OTP emails now send through Resend from an Adswish-branded address (onboarding@adswish.com) once the domain DNS is verified.",
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
