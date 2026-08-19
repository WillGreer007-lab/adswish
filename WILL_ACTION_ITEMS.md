# Adswish — Master checklist (what you need to do)

> **Current status (19 Aug 2026):** This checklist contains historical action notes. For the authoritative audit, implemented fixes, remaining code gaps, and current owner-only steps, read `BLUEPRINT_GAP_AUDIT.md` and the latest section of `GLM52_HANDOFF.md`. Migrations 031–034 are applied; the code is not considered launch-complete until the owner-only checklist is finished.

Updated Aug 19. **"Done for you"** = already built + verified in code and DB.
**"Only you"** = requires an external account only you control.

---

## ✅ Done for you (this session + prior)

- Landing page v2 badge, new headline, Plans/Businesses pages.
- Creator + business marketplaces, tier rename (Small/Moderate/Big).
- Google sign-in persistence fix + ToS tick on Google sign-up.
- Leave-site popup for **logout AND all external links site-wide**.
- **Global back button on every page.**
- Profile picture / logo upload.
- Dark mode, font size, accent colour, background, layout (Settings → Appearance).
- Paid plans → Stripe Checkout.
- Business balance (top-up → fixed-campaign spend → 90/10 cash-out, £10 min).
- Fixed-campaign balance check on accept (auto-close + notify + email on insufficient).
- Business plan limits (Free 3 / Growth 20 / Enterprise unlimited).
- Analytics pages for both roles.
- Campaign creation: per-platform hashtags, media URL, manual review.
- Two-layer tracking check + **optional third-party UptimeRobot layer**.
- Friend system: add friend, requests, friends A–Z, search, campaign invites.
- Invite accept → auto-apply to the campaign.
- Chat bug fixed (`campaigns.name` → `title`) — accepted users can now message.
- Chat realtime presence + typing indicators.
- **Business dashboard rebuilt** (real campaign/applicant/balance surfaces, no dead empty states).
- **Styled HTML email templates** (acceptance + campaign-closed) via Resend.
- Legal docs (Terms / Privacy / Subprocessors).
- Connections + invite flow verified 8/8 (`scripts/connections-e2e.mjs`).

## ✅ Sightengine moderation keys — added locally

You gave me the Sightengine API user + secret. I wrote both to `.env.local` and
`vercel-env.txt` (nothing printed/logged). `src/lib/moderation.ts` already reads
`SIGHTENGINE_API_USER` + `SIGHTENGINE_API_KEY`, so NSFW moderation on deliverable
submit is now live locally and will be live in prod once you paste `vercel-env.txt`
into Vercel (see GO_LIVE_CHECKLIST.md Step 3 — your usual flow).

> New optional env var this batch: `UPTIME_ROBOT_API_KEY` — only needed if you want
> the third tracking layer to actively gate campaigns. Without it, the third check
> shows as "not configured" and doesn't block anything. See step 5 below.

## ✅ Done for you — Stripe Connect (platform is already onboarded)

I checked your Stripe platform account read-only: **it is fully onboarded.**
`transfers: active`, `details_submitted: true`, `currently_due: []`.

So the old "complete the Connect questionnaire" blocker is gone. Creator payouts and
business cash-outs will clear once **each connected account** (creator/business)
finishes its own onboarding in-app — full steps in GO_LIVE_CHECKLIST.md "Per-user
Connect onboarding".

---

## ❗ Only you can do (external accounts) — with steps

### 1. Publish the Chrome extension publicly
1. https://chrome.google.com/webstore/devconsole → sign in → pay one-time **$5**.
2. **New item** → upload `chrome-extension/adswish-tracker-v1.2.0.zip`.
3. Copy the listing text from `chrome-extension/STORE_LISTING.md`, add a screenshot,
   set visibility **Public**, submit for review.

### 2. Fix YouTube "access blocked — this app request is invalid"

This is a Google Cloud config problem (the YouTube Data API isn't enabled for your
project and/or the app isn't published/tested). Do this in order:

1. Go to **console.cloud.google.com** → make sure the project dropdown (top) shows
   **My Project 3870** (the one with your OAuth client).
2. **APIs & Services → Library** → search **"YouTube Data API v3"** → open it →
   click **Enable** (if it says "Manage", it's already on — skip to step 4).
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** → fill app name, support email.
   - **Audience**: if you want *anyone* to use YouTube connect at launch, click
     **Publish app** (top). If you just want to test first, skip publishing and add
     yourself as a test user instead (next step).
   - **Test users** (only needed while unpublished): click **Add users** → enter
     your own Google email → Save.
   - **Scopes**: click **Add or remove scopes** → tick **`.../auth/youtube.readonly`**
     (and `youtube.readonly` if it's listed separately) → Save.
4. **APIs & Services → Credentials** → open your **Adswish** Web OAuth client →
   **Authorized redirect URIs** → make sure this exact value is present (no typos,
   copy character-for-character):
   ```
   https://kzydyzugcyiuheltfxko.supabase.co/auth/v1/callback
   ```
5. **Supabase dashboard → Authentication → Providers → Google** → confirm the same
   Client ID + Client secret are entered, and the redirect URL listed there matches
   the one above.
6. Wait **5–30 min** for Google to propagate, then retry "Connect YouTube" on the
   creator onboarding.

> The "this app request is invalid" message almost always means one of: API not
> enabled, consent screen not published, or your email isn't a test user yet.

### 3. Paste env vars into Vercel (includes the new Sightengine keys)

Do the usual: open `vercel-env.txt`, copy all, Vercel → Settings → Environment
Variables → Import → Paste → Save → Redeploy. See GO_LIVE_CHECKLIST.md Step 3.

### 4. (Optional) Add `UPTIME_ROBOT_API_KEY`

The third tracking-verification layer is wired. To activate it so it actually gates
affiliate/hybrid campaigns:

1. Create a free UptimeRobot account → **New monitor** → type **HTTP(s)** → URL =
   your business's verified domain → create it.
2. **My Settings → API Settings** → create a **Read-only API key** → copy it.
3. Add `UPTIME_ROBOT_API_KEY=<key>` to `.env.local` and `vercel-env.txt` (or tell
   me the key and I'll write it for you).

Without the key, the third check shows "not configured" and is skipped — nothing breaks.

---

## ⚠️ Reminders

- `.env.local` has **live Stripe keys** — never run `scripts/stripe-*.mjs` (they move real money).
- Audit commit `f3c4ecb` is pushed to `main`; public health routes returned 200 after the deploy wait. Add a real `VERCEL_TOKEN` only to local `.env.local` if you need the deploy script to report authenticated Vercel build state. Preview locally at **http://localhost:3000**.
