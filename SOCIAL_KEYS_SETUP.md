# TikTok & Instagram API keys — setup guide

These two platforms power the **follower re-check worker** (and the "Connect"
OAuth flow on the creator onboarding page). Right now their keys are empty, so
the worker skips them. Paste the four values when you have them.

---

## TikTok (client key + client secret)

1. Go to **https://developers.tiktok.com/** → **Log in** with a TikTok account.
2. Click **My apps** (or "Manage apps") → **Connect an app**.
3. Fill in the app info:
   - App name: `Adswish`
   - Category: `Business` / `Marketing`
   - Description: "Marketplace connecting businesses with creators; reads creator follower counts."
4. Under **Products**, enable **Login Kit** (and **Content Posting API** later if you want auto-posting).
5. On the app dashboard, copy:
   - **Client key** (a long string, looks like `awxxxxxxxxxxxxx`)
   - **Client secret** (a hex string)
6. Set the **Redirect URI** to:
   ```
   https://adswish-lake.vercel.app/api/internal/oauth/tiktok/callback
   ```
   (and, for local dev: `http://localhost:3000/api/internal/oauth/tiktok/callback`)
7. Paste the two values here:
   ```
   TIKTOK_CLIENT_KEY=...
   TIKTOK_CLIENT_SECRET=...
   ```

> TikTok puts apps in **Staging** until you submit for review. Staging lets you
> connect *your own* account for testing — that's enough to run the re-check.

---

## Instagram (client ID + client secret)

Instagram OAuth goes through the **Facebook developer platform**.

1. Go to **https://developers.facebook.com/** → **Create App**.
2. Choose **Consumer** type → give it the name `Adswish`.
3. In the app dashboard, add the **Instagram** product (and optionally
   **Instagram Basic Display**).
4. In **Instagram → API setup with Instagram login** (or Basic Display), note:
   - **Instagram App ID** (a number like `123456789012345`)
   - **Instagram App Secret** (a hex string)
5. Set the **Valid OAuth Redirect URIs** to:
   ```
   https://adswish-lake.vercel.app/api/internal/oauth/instagram/callback
   ```
   (and for local dev: `http://localhost:3000/api/internal/oauth/instagram/callback`)
6. Paste the two values here:
   ```
   INSTAGRAM_CLIENT_ID=...
   INSTAGRAM_CLIENT_SECRET=...
   ```

> **Important:** Instagram requires the app to pass **App Review** before *other*
> people can connect. Until then only testers/your own account work — same
> staging limitation as TikTok. Add your own account as a tester to run the
> re-check now.

---

## What happens after you paste them

I'll wire the four values into `.env.local` + `vercel-env.txt`, then run the
follower re-check end-to-end: each connected account's live count is re-fetched,
the creator's tier is recomputed, and badges refresh. YouTube already works
(the Google client ID is configured), so only TikTok + Instagram are waiting on
these keys.

> **Note on Google:** you asked to blur "Continue with Google" and mark it
> "Coming soon". That is now done on login + signup. Google's OAuth client
> ID/secret are still configured — say the word to re-enable the button when you
> want it back.
