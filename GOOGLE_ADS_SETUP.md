# Google Ads Integration — Setup Guide (Owner Steps)

This guide walks you through getting the four environment variables the Phase 2
Google Ads integration needs. These are **owner-only** values: create them
yourself, add them to Vercel, and never commit them to git.

## What you'll end up with

| Variable | Where it comes from |
|----------|---------------------|
| `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud Console → Credentials |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google Cloud Console → Credentials |
| `GOOGLE_OAUTH_REDIRECT_URI` | Fixed string (see step 5) |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API Center |

---

## Step 1 — Create a Google Cloud project

1. Go to **https://console.cloud.google.com/** and sign in with the Google
   account you want to own the integration (ideally a dedicated admin account,
   not a personal one).
2. In the top bar, click the project dropdown → **New project**.
3. Name it `Adswish` (or `Adswish Google Ads`) and click **Create**.
4. Wait for the project to be created, then make sure it's selected in the
   top bar.

## Step 2 — Enable the Google Ads API

1. In the Cloud Console, open the menu (☰) → **APIs & Services** → **Library**.
2. Search for **Google Ads API**.
3. Click it → **Enable**.
   - This is required before the OAuth token can talk to the Ads API.
   - (Optional) If you also want analytics read access later, enable
     **Google Analytics Data API** the same way — but it is not needed for
     the current connect flow.

## Step 3 — Configure the OAuth consent screen

1. Open the menu (☰) → **APIs & Services** → **OAuth consent screen**.
2. Choose **External** (you're a third-party tool connecting to other
   businesses' Google Ads accounts) → **Create**.
3. Fill in:
   - **App name**: `Adswish`
   - **User support email**: your support email
   - **App domain** section: add your domain `adswish.com` (and the
     authorized domain `adswish-lake.vercel.app` if prompted)
   - **Developer contact email**: your email
4. On the **Scopes** screen, add the scope:
   ```
   https://www.googleapis.com/auth/adwords
   ```
   (This is the only scope the current code requests — it lets Adswish manage
   the connected Google Ads campaigns.)
5. Add yourself as a **Test user** (needed while the consent screen is in
   "Testing" mode).
6. Save. Leave it in **Testing** while you develop; you'll submit it for
   verification before going live to real businesses.

> **Compliance note:** while in Testing mode, only test users can connect.
> Before public launch you must submit the consent screen for Google's review
> and pass their third-party/ad-policy verification. Do **not** publish live
> until that review is approved.

## Step 4 — Create the OAuth client (ID + secret)

1. Open the menu (☰) → **APIs & Services** → **Credentials**.
2. Click **+ Create credentials** → **OAuth client ID**.
3. Application type: **Web application**.
4. Name: `Adswish Web`.
5. Under **Authorized redirect URIs**, click **Add URI** and add **both**:
   ```
   https://adswish-lake.vercel.app/api/internal/google-ads/callback
   http://localhost:3000/api/internal/google-ads/callback
   ```
   (The production one is required; the localhost one lets you test the
   connect flow in local dev.)
6. Click **Create**.
7. A dialog appears with your **Client ID** and **Client secret**.
   - Copy the **Client secret** now — Google only shows it once here.
   - These become `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`.

## Step 5 — Set the redirect URI variable

`GOOGLE_OAUTH_REDIRECT_URI` is a fixed string, not something Google gives you.
Set it to:

```
https://adswish-lake.vercel.app/api/internal/google-ads/callback
```

> The app builds the redirect from the request origin dynamically, but this
> env value is the canonical production one and **must exactly match** one of
> the URIs you entered in step 4 (no trailing slash, same case).

## Step 6 — Get the Google Ads developer token

1. Go to **https://ads.google.com/** and sign in with a Google Ads account
   (or create one — a test MCC/manager account works for development).
2. Open the top-right tools menu → **Access and security** (or navigate to
   **API Center** under Tools).
3. Find the **Developer token** section.
4. Copy the developer token (a 22-character string starting with a letter).
   - A new token starts at **test access** level, which is fine for
     development.
   - For production you'll later apply to Google for **standard access**,
     which requires meeting their spending history / policy review.
5. This becomes `GOOGLE_ADS_DEVELOPER_TOKEN`.

## Step 7 — Add everything to Vercel

In **Vercel → your project → Settings → Environment Variables**, add these
four (Production **and** Preview environments):

```
GOOGLE_OAUTH_CLIENT_ID=<your client id>
GOOGLE_OAUTH_CLIENT_SECRET=<your client secret>
GOOGLE_OAUTH_REDIRECT_URI=https://adswish-lake.vercel.app/api/internal/google-ads/callback
GOOGLE_ADS_DEVELOPER_TOKEN=<your developer token>
```

For **local development**, put the same four values in `.env.local` (which is
gitignored — never commit it).

Then **redeploy** on Vercel so the new env vars take effect.

---

## How to verify it works

1. Sign in to Adswish as a business, open
   **Dashboard → Google Ads**, and click **Connect** (or **Sign in with
   Google** in the Amplify wizard).
2. If the env vars are missing, you'll see "Google Ads is not configured yet"
   instead of being sent to Google.
3. With the vars set, Google's consent screen opens. Pick a Google Ads account
   and approve.
4. You're redirected back to the Google Ads dashboard with `?connected=1` and
   the connection status turns **Connected**.
5. The **Campaigns** tab then lists the accessible customer's campaigns via
   the `listAccessibleCustomers` + GAQL search calls.

---

## Phase 4 — A/B thumbnail assets, partner credits, blended ROAS

### A/B thumbnail assets

On approved deliverables with an uploaded video, the Google Ads dashboard shows
an **A/B thumbnail assets** section:

1. **Generate thumbnails** extracts three JPEG frames from the video at 10% /
   50% / 90% of its duration (FFmpeg, bundled via `ffmpeg-static`).
2. The frames are stored in the public `google-ads-assets` storage bucket and
   shown side by side as **Variants A / B / C**.
3. Click **Use this** on a variant to mark it the chosen creative — it's
   linked to the Adswish campaign (`google_ads_campaigns.ab_asset_id`) and
   used when building the ad.

A nightly cron job (`google-ads-thumbnails`) also auto-generates thumbnails
for newly approved deliverables, so most videos get assets without anyone
clicking anything. If a video can't be processed (unsupported codec, missing
file), the assets show a `failed` state with the reason instead of silently
failing.

### Google Partner credits

The dashboard has a **Google Partner credit** panel: businesses can apply for
the £500 first-campaign credit from the Google Partners program. Applications
are stored in `google_ads_partner_credits` and reviewed by the platform team
(status: not applied → applied → approved/declined). Approval still requires
meeting Google Partners eligibility — the panel tracks the application, it
doesn't grant spend.

### Blended ROAS

The **Blended ROAS** analytics view combines:

- **Organic** revenue — conversions attributed through the business's own
  Adswish tracking links (last 30 days, per-day series).
- **Paid** revenue/spend/conversions — from the Google Ads campaigns
  (populated by the `google-ads-reporting` cron once the developer token is
  set).

You get revenue-by-source (organic vs paid), a 30-day organic revenue chart,
blended revenue, and blended ROAS (total revenue ÷ paid spend).

### What works without the developer token

| Capability | Without token | With token |
|-----------|---------------|------------|
| Sign in with Google (OAuth connect) | ✅ | ✅ |
| Campaign drafts (Save as Draft) | ✅ | ✅ |
| A/B thumbnail extraction & selection | ✅ | ✅ |
| Partner credit application | ✅ | ✅ |
| Kill-switch settings (saved locally) | ✅ | ✅ |
| Blended ROAS — organic side | ✅ | ✅ |
| Blended ROAS — paid side | ❌ zeros | ✅ real numbers |
| Live campaign create / pause / resume / inject | ❌ | ✅ |
| Auto-kill switch live pause | ❌ inert | ✅ |

Everything except the live Ads API operations degrades gracefully — the UI
explains what's missing instead of erroring.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `error_mismatch` / redirect URI error from Google | The redirect URI in Vercel (or the request origin) doesn't exactly match an entry in step 4. |
| `google_ads_not_configured` | One of the OAuth env vars is missing/empty. |
| `access_denied` | The signed-in Google account isn't a **Test user** on the consent screen, or the consent screen is still in Testing mode. |
| Ads API returns `DEVELOPER_TOKEN` error | The developer token is still at test access, or it was added to the wrong Google account. |
| Thumbnails show `failed` with an FFmpeg message | The server can't run FFmpeg (serverless without the binary) or the video is an unsupported codec — see Phase 4 above. |
