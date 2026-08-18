# Adswish — Go-Live Checklist (step-by-step, do in this order)

Everything below is a **human action** (browser/dashboard steps). The code is already
deployed — these are the config steps that only you can do because they need your
Google / Vercel / Stripe / Supabase logins.

> Code status: `main` is pushed to GitHub (`WillGreer007-lab/adswish`) and Vercel
> auto-deploys on every push. The latest commit `ac22006` includes realtime chat,
> dynamic OG images, MP4 upload, the Chrome-extension landing section, the live-key
> guard, and migrations 018–021 (all applied to the cloud DB).

---

## STEP 1 — Get your production URL (5 min, unblocks everything)

Your site is deployed but **hidden behind Vercel's Deployment Protection**, so nobody
(including the cron jobs) can reach it without logging in.

1. Go to **vercel.com** → your project (**adswish**, the one connected to
   `WillGreer007-lab/adswish` — *not* `nextjs-boilerplate`).
2. In the top of the dashboard you'll see the production URL — it looks like
   `https://adswish-XXXX.vercel.app` or a custom domain you've added.
3. Click **Settings → Deployment Protection**:
   - If **Vercel Authentication** is ON for Production, turn it **Off** (or add
     your team as bypass). Otherwise visitors and your cron jobs get bounced to a
     login page.
4. Copy the production URL. **This is the URL you'll paste in Steps 2, 5, and 6.**

> If you already have a custom domain (e.g. `adswish.com`) attached, use that — it's
> the cleanest choice.

---

## STEP 2 — Fix the Google redirect URI (5 min, fixes Google sign-in)

Your Google Cloud Console has a **typo'd Supabase callback URL**, so "Continue with
Google" fails with `redirect_uri_mismatch`.

1. Go to **console.cloud.google.com** → your project (**My Project 3870**) →
   **APIs & Services → Credentials** (or **Google Auth Platform → Clients**).
2. Open the client named **Adswish** (`709354748675-v1g8937ckq2ba0s14jn2utnuks9a1575`).
3. In **Authorized redirect URIs**, replace the existing value with **exactly**:
   ```
   https://kzydyzugcyiuheltfxko.supabase.co/auth/v1/callback
   ```
   (Your saved value is `https://kzydzycgcyiuhelftfko...` — note the different
   middle. Copy the correct one above character-for-character; do not re-type.)
4. Click **Save**.
5. Google says it can take **5 minutes to a few hours** to propagate. Test after ~10
   minutes on `/login` → Continue with Google.

> Optional (for the subscriber-verification feature): enable the **YouTube Data API
> v3** for this project in **APIs & Services → Library**.

---

## STEP 3 — Paste env vars into Vercel (10 min)

Your `vercel-env.txt` file (in `~/Adswish 3`) already has every key in ready-to-paste
format. The Supabase↔Vercel integration auto-syncs the Supabase vars; everything else
you paste manually.

1. Open `vercel-env.txt` in TextEdit, select all (**⌘A**), copy (**⌘C**).
2. Go to **vercel.com** → your project → **Settings → Environment Variables**.
3. Click **Import** → **Paste**, then paste the whole file contents (⌘V). It should
   fill in ~20 rows in one shot.
4. Make sure **Production** (and optionally Preview/Development) is selected, then
   **Save**.
5. **Verify these are present** (the important ones):
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (auto-synced)
   - `SUPABASE_SERVICE_ROLE_KEY` (auto-synced)
   - `STRIPE_SECRET_KEY` — must start with **`sk_live_`**
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — must start with **`pk_live_`**
   - `STRIPE_CURRENCY=gbp`
   - `CRON_SECRET` — must equal the value in your `.env.local` (starts `f03a0a96…`)
   - `JWT_SIGNING_SECRET`, `MESSAGE_ENCRYPTION_KEY`
   - Upstash (`UPSTASH_REDIS_REST_URL` + token), `RESEND_API_KEY`,
     `SIGHTENGINE_API_USER` + `SIGHTENGINE_API_KEY`, `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
6. Click **Redeploy** (Deployments → latest → ⋯ → Redeploy) so the new env vars apply.

> ⚠️ Do NOT paste `SUPABASE_DB_URL` into Vercel — that's for local DB admin only.
> ⚠️ Do NOT paste `SUPABASE_ACCESS_TOKEN` — keep it local for migrations.

---

## STEP 4 — Live Stripe webhook (10 min, required for payouts to work live)

1. Go to **dashboard.stripe.com** → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL (replace `<YOUR-URL>` from Step 1):
   ```
   https://<YOUR-URL>/api/webhooks/stripe
   ```
3. Events to listen to — select **all** of these:
   `account.updated`, `checkout.session.completed`, `invoice.payment_succeeded`,
   `invoice.payment_failed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `payment_intent.payment_failed`, `payment_intent.succeeded`,
   `charge.refunded`, `charge.dispute.closed`, `transfer.failed`, `transfer.paid`.
4. Create the endpoint, then copy the **Signing secret** (`whsec_…`).
5. Back in Vercel (Step 3): add/edit **`STRIPE_WEBHOOK_SECRET`** = that `whsec_…`
   value, select Production, Save, Redeploy.

> Keep your local `.env.local` `STRIPE_WEBHOOK_SECRET` (test `whsec_e2e_…`) for local
> dev — the two are separate.

---

## STEP 5 — Point pg_cron at production (2 min, I can do this)

Once you know the URL from Step 1, either:

- Tell me the URL and I'll run it, or
- Run it yourself in the Supabase dashboard **SQL Editor**:
  ```sql
  UPDATE public.app_settings
  SET value = 'https://<YOUR-URL>'
  WHERE key = 'cron_base_url';
  ```
  (replacing `<YOUR-URL>` — no trailing slash).

The cron schedules already read this value every run (migration 019) and send the
matching `CRON_SECRET`, so no other change is needed.

---

## STEP 6 (optional) — Instagram / TikTok OAuth keys

Only needed for the "Connect Instagram/TikTok" creator features. Both require app
review; skip if you don't need social proof verification yet.

- **Instagram:** developers.facebook.com → My Apps → **Create App** (Consumer) →
  add the **Instagram API** product → copy **App ID** (`INSTAGRAM_CLIENT_ID`) +
  **App Secret** (`INSTAGRAM_CLIENT_SECRET`) → paste into Vercel.
- **TikTok:** developers.tiktok.com → Manage apps → **Connect an app** → Login Kit →
  **Client key** (`TIKTOK_CLIENT_KEY`) + **Client secret** (`TIKTOK_CLIENT_SECRET`).
- Add the callback URL (from the guide in `DEPLOYMENT_GUIDE.md` §6.5) to each app.

---

## Final verification (after Steps 1–5)

1. Open `https://<YOUR-URL>` in Safari — landing page loads, no login wall.
2. `/login` → **Continue with Google** → sign in completes (no `redirect_uri_mismatch`).
3. Sign in as `willgreer38@gmail.com / 123456` (business) → dashboard loads.
4. Business → **Settings → Tracking** → shows your real Business ID + API URL.
5. Ask me to run the cron base-URL update + a live webhook smoke test once you have
   the URL, and I'll verify the scheduled jobs fire against production.
