# Creator Verification Systems — How Both Methods Work

Adswish verifies a creator's social reach before they can join campaigns and earn a
tier. There are **two completely independent systems** for doing this, and a creator
chooses between them (and can mix them) via the **two boxes** shown at the top of
onboarding Step 2 and in the dashboard **Settings → Connected accounts** panel.

```
┌──────────────────────────┐   ┌──────────────────────────┐
│  1. AUTOMATION SETUP     │   │  2. MANUAL SIGN UP       │
│  (main method)           │   │  (option 2)              │
│  OAuth / API keys        │   │  code-in-bio + screenshot│
│  follower count auto-    │   │  follower count admin-   │
│  verified instantly      │   │  reviewed                │
└──────────────────────────┘   └──────────────────────────┘
```

Each box carries a **status badge** so the creator always knows where they stand:

| Status | Meaning |
| --- | --- |
| **Not started** | Nothing submitted/connected yet. |
| **Requires review** | Submitted, waiting on a human (manual only). |
| **Completed** | Verified and live. |
| **Failed** | The last attempt errored (e.g. an OAuth callback failure). |

---

## 1. Automation setup — the main method

Automation is the primary path because it is **instant and self-healing**: once a
platform is connected, Adswish pulls the follower count directly from the platform
and keeps it fresh on a monthly re-check — no screenshot, no admin review, no
waiting.

### 1.1 The three automatable platforms

| Platform | Mechanism | Ownership proof | Auto-verified? |
| --- | --- | --- | --- |
| **Instagram** | OAuth (Instagram Basic Display) | OAuth consent — only the logged-in account holder can grant the token | ✅ immediately |
| **TikTok** | OAuth (TikTok v2) | OAuth consent | ✅ immediately |
| **YouTube** | Plain API key + self-serve challenge | Per-account code pasted into the channel **About** description | ✅ after the code is confirmed |

**Twitter/X has no automation path** in this system (no privileged API), so it must
use manual sign up. This is surfaced explicitly in the UI.

### 1.2 Instagram flow, end to end

1. Creator clicks **Connect with Instagram** in the automation panel.
2. The browser navigates to `GET /api/internal/oauth/instagram`, which checks
   `INSTAGRAM_CLIENT_ID` / `INSTAGRAM_CLIENT_SECRET`. If missing, the route
   redirects back with `?error=instagram_not_configured` (never a hard crash).
3. The route redirects to Instagram's authorize endpoint with `state = user id`.
4. Instagram redirects back to `GET /api/internal/oauth/instagram/callback` with a
   one-time `code`.
5. The callback exchanges the code for a short-lived access token, then upgrades it
   to a **long-lived token** via `ig_exchange_token` (60 days).
6. It reads `username` + `followers_count` from `graph.instagram.com/me`.
7. It **upserts** a `creator_social_accounts` row (on conflict
   `creator_id,platform`) with `verified_at = now`, the access token, and its expiry.
8. It refreshes the creator's badges and redirects back to
   `/onboarding/creator/connect_social?success=instagram` (or the profile in
   Settings).

A background job (`refreshExpiredTokens` in `src/lib/oauth/token-refresh.ts`)
refreshes expiring tokens; after three failed refreshes the account is soft-
disconnected and the creator is notified to reconnect.

### 1.3 TikTok flow, end to end

Same shape as Instagram, but with TikTok's v2 OAuth:

- `GET /api/internal/oauth/tiktok` checks `TIKTOK_CLIENT_KEY` /
  `TIKTOK_CLIENT_SECRET`.
- Token exchange at `open.tiktokapis.com/v2/oauth/token/`.
- Follower count from `open.tiktokapis.com/v2/user/info/`.
- Stores `access_token` + `refresh_token` + both expiries, marks `verified_at`.
- Redirects back with `?success=tiktok`.

### 1.4 YouTube flow (self-serve, no OAuth)

YouTube is special: it needs **no consent screen**. The YouTube Data API v3 returns
a public channel's subscriber count *and* its public About description with a plain
`YOUTUBE_API_KEY`.

1. Creator pastes their handle into the automation panel.
2. `POST /api/internal/oauth/youtube/verify` resolves the channel.
3. The route derives a **per-account challenge code** (from the JWT secret + user
   id + platform) and checks whether it appears in the live channel description.
4. If it's missing, the route returns `403` + `needs_bio_proof: true` + the code,
   and the UI tells the creator to paste it into their channel About and click
   **Verify** again.
5. Once the code is present, the account is upserted with `verified_at = now`, the
   tier is recomputed, and badges refresh.

This ownership proof stops anyone from claiming a famous channel they don't control.

### 1.5 The monthly re-check

`recheckFollowerCounts` (a pg_cron job) walks every non-disconnected
`creator_social_accounts` row each month and:

- Refreshes Instagram/TikTok via their access tokens.
- Resolves YouTube by handle with the API key.
- **Skips** any platform whose keys/token are missing (never an error).
- Skips Twitter (no live API).
- Recomputes the creator's tier from their highest count and refreshes badges.

---

## 2. Manual sign up — option 2 (the fallback)

Manual sign up exists for two reasons:

1. **Twitter/X** (and any platform without an automation API).
2. **When automation keys aren't configured** — the automation panel says
   "Not configured — use manual below" instead of dead-ending.

Manual is a **human-reviewed** path: the creator proves ownership by posting a
code, and an admin confirms it before the count is accepted.

### 2.1 How the code works

`deriveVerificationToken(userId, platform)` in
`src/lib/verification-token.ts` produces a **stateless, per-user + per-platform**
code:

```
HMAC-SHA256(JWT_SIGNING_SECRET, "verification:<platform>:<userId>")
  → base64url → uppercase → strip O/0/I/1/L → "ADSWISH-XXXXXX"
```

- It is **stable** (the creator pastes it once; it never changes for that account).
- It is **derived, not stored** — no DB row needed to generate it.
- It differs per platform and per user, so it cannot be reused to impersonate
  someone else.

### 2.2 The steps (the 4-step wizard)

1. **Platform** — pick TikTok, Instagram, YouTube, or Twitter/X.
2. **Details** — enter the handle + follower count; the tier preview updates live
   (Small 10K / Moderate 100K / Big 1M).
3. **Verify** — copy the `ADSWISH-XXXXXX` code into the platform bio/description,
   take a screenshot showing the code + follower count, and upload it.
4. **Review** — confirm, then **Submit for review**.

`POST /api/internal/manual-verifications` stores the submission in
`manual_follower_verifications` with `status = "pending"`, uploading the screenshot
to the private `creator-verification` storage bucket.

### 2.3 Admin review

An admin reviews the screenshot in the admin dashboard. They either:

- **Approve** → the follower count becomes the creator's verified count, tier and
  badges are computed from it, and the manual box flips to **Completed**.
- **Reject** → the box shows **Failed** with the review note, and the creator can
  resubmit.

Until approval, the manual box shows **Requires review**.

---

## 3. How the two boxes compute their status

`src/lib/verification-methods.ts` is the single source of truth:

- **Automation** = `completed` if any non-disconnected `creator_social_accounts`
  row has a `verified_at`; `failed` if the last OAuth redirect came back with
  `?error=…`; otherwise `not_started`.
- **Manual** = `completed` if any `manual_follower_verifications` row is
  `approved`; `requires_review` if any is `pending`; `failed` if the latest is
  `rejected`; otherwise `not_started`.

`GET /api/internal/oauth/status` returns which automation providers are configured
(booleans only — no secrets) so the UI can render a **Connect** button versus a
**Not configured** notice.

---

## 4. Where the two boxes appear

| Surface | Component | Notes |
| --- | --- | --- |
| Onboarding Step 2 | `src/app/(auth)/onboarding/creator/connect_social/page.tsx` | Two boxes first; each routes into its own steps. |
| Settings → Connected accounts | `src/components/dashboard/verification-methods.tsx` | Same two boxes + the connected list. |

Both surfaces share:

- `VerificationMethodPicker` (`src/components/verification/method-picker.tsx`) —
  the two boxes with status badges.
- `AutomationSetup` (`src/components/verification/automation-setup.tsx`) — the
  OAuth buttons + YouTube self-serve.
- `ManualFollowerVerification` (`src/components/dashboard/manual-follower-verification.tsx`) —
  the code + screenshot form.

---

## 5. Which method should a creator pick?

- **Automation** is best for Instagram, TikTok, and YouTube — instant, no waiting,
  self-refreshing.
- **Manual** is required for Twitter/X and is the fallback when a platform's API
  keys aren't configured yet.

The two systems are complementary, not competing: a creator can automate Instagram
and manually verify Twitter/X at the same time, and the highest verified follower
count across all connected accounts determines their tier.
