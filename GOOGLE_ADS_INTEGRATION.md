# Google Ads Integration — Full Build Prompt

## Overview

Add a Google Ads amplification feature to Adswish that allows businesses to turn approved creator content into paid Google Ads — directly from the dashboard, on **ALL plans** (Free, Growth, Enterprise).

---

## 1. Legal & Technical Foundation

### Parallel Tracking (Mandatory)
- Google bans standard 302 redirects for paid ads
- Backend uses Google Ads API to inject a **Parallel Tracking template**
- Buyer goes instantly to final product page while tracking link pings invisibly in background
- Organic tracking links (302) remain unchanged for non-ad traffic

### Third-Party Policy
- Connected via OAuth — Adswish acts as third-party tool
- Reporting must clearly separate Google Ads data from organic data
- No data sharing with third parties without consent

---

## 2. User Experience (Two Paths)

### Path A: The "Magic" Builder (Auto-Generation)

**Trigger:** Business clicks "Amplify" on an approved creator video

**Backend Action:**
1. Pull 1080p MP4 from Supabase Storage
2. Fire to Google Ads API to construct Demand Gen or Performance Max campaign
3. Auto-write headlines from creator's cover note
4. Set tracking template with JWT token

**UX Flow:**
1. Business watches video in native browser player
2. Clicks "Approve Deliverable"
3. New button appears: **Amplify with Google Ads**
4. Tooltip: "Turn this proven organic post into a paid ad. Zero setup fees."

**Setup Modal (3 inputs only):**

| Input | Type | Options |
|-------|------|---------|
| Goal | Dropdown | Capture Search Traffic (Text Ads), Drive Social Discovery (YouTube Shorts / Demand Gen), Maximize Everywhere (Performance Max) |
| Target Location | Search bar | Country or city |
| Daily Budget | Number input | e.g., $50/day |

**Split Button:**
```
[ Save as Draft (Review Before Spending) ] [ Launch Campaign Now ]
```

**Handoff (Save as Draft):**
1. Skeleton loader pulses ~3 seconds while backend talks to Google Ads API
2. Green toast: "Campaign built successfully! Your tracking is perfectly configured."
3. CTA: "Click here to review and enable your campaign in Google Ads"
4. New tab opens > Google Ads account > exact campaign built
5. Business reviews auto-generated headlines, watches video preview
6. Clicks Google's green "Enable" button when ready

### Path B: The Seamless Injector

**Trigger:** Business clicks "Link Existing Ad" tab in modal

**UX Flow:**
1. Modal populates filterable data table of active Google Ads campaigns (pulled live via API)
2. Table shows: Campaign Name, Daily Budget, Status
3. Far right column: **[ Inject Tracking ]** button per row
4. Business finds campaign, clicks button
5. Loading spinner > green checkmark **Tracking Active**
6. Done — no URL parameter editing needed

**What Happens Behind Scenes:**
- Platform automatically updates Google Ads tracking template
- Traffic from Google Ad now attributed on dashboard alongside organic traffic
- Creator's organic data + paid ad data shown together

---

## 3. Cost Structure (Free for Business)

### Zero Commission on Ad Spend
- Business connects **their own credit card** directly to Google
- Google bills them for clicks — Adswish doesn't touch ad budget
- No markup on ad spend
- Massive selling point: "Run Google Ads through Adswish for free"

### How Adswish Monetizes
- **Available on ALL plans** — Free, Growth, Enterprise
- No feature gating — every business gets Google Ads amplification
- Revenue comes from:
  - 10% platform commission on campaign conversions (existing)
  - Subscription plans (existing)
  - Future: Google Partner credits ($500 for new businesses)

---

## 4. Auto-Kill Switch (Budget Protection)

### How It Works
- Background job monitors Google Ads API performance data
- If campaign drops below profitability threshold > auto-pause
- Protects business from budget waste

### User-Configurable Limits
Business sets their own thresholds:

| Setting | Default | Range |
|---------|---------|-------|
| Max daily spend | $50 | $10-$500 |
| Max total spend | $500 | $50-$5,000 |
| Min conversions before kill | 0 | 0-10 |
| Pause if ROAS < X | 1.0 | 0.5-5.0 |

### Kill Switch Behavior
1. Campaign exceeds threshold
2. Auto-pause via Google Ads API
3. Notification sent to business: "Campaign auto-paused — budget protection triggered"
4. Business can manually resume if desired

---

## 5. A/B Test Asset Extraction

### Lightweight FFmpeg Pipeline
1. Extract 3 different thumbnail frames from creator's video
2. System automatically builds 3 ad variants
3. Google's algorithm tests which visual drives cheapest clicks
4. Winner gets more budget allocation

### UX
- Business sees 3 thumbnail previews in dashboard
- Can manually select preferred thumbnail
- Or let Google optimize automatically

---

## 6. Google Partner Credits (Future)

### Path to Partnership
1. Platform manages enough connected ad volume
2. Join Google Partners program
3. Automatically inject $500 Google Ads credit into new business accounts
4. Credits applied when they launch first campaign through Adswish

### Requirements
- $10,000+/month ad spend through platform
- Google Partner certification
- Minimum 90-day account history

---

## 7. Unified Blended ROAS Dashboard

### Dedicated Analytics View
- Compare organic creator traffic vs paid Google Ads traffic
- Side-by-side metrics:
  - Impressions
  - Clicks
  - Conversions
  - Revenue
  - ROAS
  - Cost per acquisition

### Filters
- Date range (Today, 7 days, 30 days, Custom)
- Campaign type (Organic, Paid, Both)
- Creator
- Platform (Google, YouTube, TikTok, Instagram)

### Charts
- Line chart: Organic vs Paid conversions over time
- Bar chart: Revenue by traffic source
- Pie chart: Traffic distribution
- Table: Detailed breakdown by campaign

---

## 8. Technical Implementation

### Database Schema
```sql
-- Google Ads campaigns linked to Adswish campaigns
CREATE TABLE google_ads_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adswish_campaign_id uuid REFERENCES campaigns(id),
  google_campaign_id text NOT NULL,
  google_campaign_name text,
  status text DEFAULT 'draft', -- draft, active, paused, removed
  daily_budget_cents bigint,
  total_spend_cents bigint DEFAULT 0,
  conversions integer DEFAULT 0,
  revenue_cents bigint DEFAULT 0,
  kill_switch_threshold jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tracking templates for parallel tracking
CREATE TABLE google_ads_tracking_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES google_ads_campaigns(id),
  template_url text NOT NULL,
  final_url_suffix text,
  parallel_tracking_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

### API Routes
```
POST /api/internal/google-ads/campaigns          -- Create new campaign
GET  /api/internal/google-ads/campaigns          -- List campaigns
POST /api/internal/google-ads/campaigns/:id/inject -- Inject tracking
POST /api/internal/google-ads/campaigns/:id/pause  -- Pause campaign
POST /api/internal/google-ads/campaigns/:id/resume -- Resume campaign
GET  /api/internal/google-ads/analytics          -- Blended ROAS data
```

### Background Jobs
```
google-ads-sync         -- Sync campaign status from Google API
google-ads-kill-switch  -- Monitor budgets, auto-pause if exceeded
google-ads-reporting    -- Pull performance data for dashboard
```

---

## 9. Implementation Phases

### Phase 1: UI Only (Week 1)
- "Amplify" button on approved deliverables
- Setup modal with 3 inputs
- Draft/Launch split button
- Mock API responses

### Phase 2: Google Ads API Sandbox (Week 2)
- OAuth flow with Google
- Sandbox campaign creation
- Tracking template injection
- Parallel tracking compliance

### Phase 3: Production Integration (Week 3)
- Live campaign creation
- Auto-kill switch with user thresholds
- Budget monitoring
- Notification system

### Phase 4: Analytics & Polish (Week 4)
- Blended ROAS dashboard
- A/B test asset extraction
- Google Partner credits setup
- Documentation

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Businesses using Amplify | 30% within 3 months |
| Average ad spend per business | $500/month |
| Platform revenue from subscriptions | +20% uplift |
| User retention | +15% (stickier product) |
| Google Partner status | Within 6 months |

---

## 11. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Google API changes | Abstract API layer, version endpoints |
| Compliance violations | Parallel tracking built-in, audit logs |
| Budget overruns | Auto-kill switch, user-configurable limits |
| Low adoption | Available on ALL plans, zero commission on spend |
| Data privacy | GDPR compliant, no data sharing without consent |

---

## 12. What Makes This Unique

1. **Free for businesses** — no commission on ad spend
2. **Available on ALL plans** — not gated behind premium
3. **One-click amplification** — approve video > amplify in 3 clicks
4. **Auto-kill switch** — protects budgets automatically
5. **Blended analytics** — organic + paid data in one view
6. **Parallel tracking** — Google compliant out of the box
7. **A/B testing** — automatic thumbnail extraction
8. **Google Partner credits** — $500 for new businesses

---

## Summary

This feature turns Adswish from an influencer marketplace into a **full-stack marketing platform**. Businesses can:
- Find creators
- Run campaigns
- Track conversions
- **Amplify with Google Ads** — all in one place

Available on **ALL plans** — Free, Growth, Enterprise. Zero commission on ad spend. Maximum value for minimum friction.

---

## 13. Integration Dashboard

### Overview
A central hub where businesses can browse, connect, and manage external integrations (Google Ads, Meta Ads, TikTok Ads, etc.)

### Location
```
/dashboard/business/integrations
```

### UI Layout

#### Header
```
Integrations
Connect your favorite tools to amplify your campaigns.
```

#### Integration Cards Grid

| Card | Icon | Status | Action |
|------|------|--------|--------|
| Google Ads | Google logo | Not Connected | [Add Google Ads] |
| Meta Ads | Meta logo | Not Connected | [Add Meta Ads] |
| TikTok Ads | TikTok logo | Not Connected | [Add TikTok Ads] |
| YouTube | YouTube logo | Connected | [Manage] |
| Instagram | Instagram logo | Connected | [Manage] |
| Stripe | Stripe logo | Connected | [Manage] |

### Card States

#### Not Connected
- Grey border
- "Add [Integration]" button (primary blue)
- Brief description: "Amplify your creator content with paid ads"

#### Connected
- Green border with checkmark
- "Manage" button (secondary)
- Last synced timestamp
- Quick stats (if applicable)

#### Pending
- Yellow border with spinner
- "Connecting..." text
- Progress indicator

---

## 14. Google Ads Connection Flow

### Step 1: Click "Add Google Ads"

**Modal Title:** Connect Google Ads

**Step-by-Step Process Display:**

```
Step 1 of 4: Sign in to Google
├── Click the button below to sign in with your Google account
├── Select the Google Ads account you want to connect
└── Grant Adswish permission to manage your campaigns

[ Sign in with Google ]

Step 2 of 4: Select Campaign
├── Choose an existing Google Ads campaign to connect
├── Or create a new campaign from scratch
└── We'll automatically set up tracking for you

[ Select Campaign ]

Step 3 of 4: Configure Tracking
├── Parallel tracking will be enabled automatically
├── Your tracking template will be injected
└── No changes to your existing campaigns required

[ Configure Tracking ]

Step 4 of 4: Review & Activate
├── Review your connection settings
├── Test the tracking link
└── Activate the integration

[ Activate Integration ]
```

### Step 2: Click "Sign in with Google"

**What Happens:**
1. Opens Google OAuth consent screen
2. Business selects Google Ads account
3. Grants permissions:
   - `https://www.googleapis.com/auth/adwords` (manage campaigns)
   - `https://www.googleapis.com/auth/analytics.readonly` (read analytics)
4. Redirects back to Adswish with auth code
5. Backend exchanges code for access token
6. Stores encrypted token in database

### Step 3: Click "Select Campaign"

**Modal Content:**
```
Select a Google Ads Campaign

┌─────────────────────────────────────────────────────────┐
│ Campaign Name          │ Daily Budget │ Status          │
├─────────────────────────────────────────────────────────┤
│ Summer Promo 2026      │ $100/day     │ Active          │
│ Brand Awareness        │ $50/day      │ Active          │
│ Product Launch         │ $200/day     │ Paused          │
└─────────────────────────────────────────────────────────┘

[ + Create New Campaign ]

Selected: Summer Promo 2026
[ Continue ]
```

### Step 4: Click "Configure Tracking"

**What Happens:**
1. Backend injects parallel tracking template into selected campaign
2. Template URL: `https://adswish-lake.vercel.app/t/{slug}?parallel=1`
3. Final URL suffix: `&utm_source=adswish&utm_medium=creator&utm_campaign={campaign_id}`
4. Google validates the template
5. Confirmation shown to user

### Step 5: Click "Activate Integration"

**Success State:**
```
✅ Google Ads Connected!

Your campaign "Summer Promo 2026" is now connected to Adswish.

Tracking is active and will attribute all traffic from this ad to your dashboard.

[ View Analytics ] [ Manage Integration ]
```

---

## 15. Google Ads Dashboard

### Location
```
/dashboard/business/google-ads
```

**Position:** Below Analytics in sidebar navigation

### Sidebar Navigation Order
```
Dashboard
Campaigns
Applicants
Analytics
Google Ads        <-- NEW
Tracking
Payments
Plan
Messages
Settings
```

### Dashboard Layout

#### Header
```
Google Ads
Connected: Summer Promo 2026
Last synced: 2 minutes ago
```

#### Quick Stats Row
```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│ Total Spend │ Clicks      │ Conversions │ ROAS        │ Cost/Conv   │
│ $1,250.00   │ 12,450      │ 89          │ 3.2x        │ $14.04      │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

#### Charts Section

**Chart 1: Performance Over Time (Line Chart)**
- X-axis: Date (last 30 days)
- Y-axis: Metric (toggleable: Spend, Clicks, Conversions, ROAS)
- Two lines: Google Ads vs Organic Creator Traffic

**Chart 2: Traffic Source Comparison (Bar Chart)**
- Bars: Google Ads, Organic, Direct, Referral
- Y-axis: Conversions
- Color-coded by source

**Chart 3: Campaign Performance (Table)**
```
┌──────────────────────────────────────────────────────────────────────┐
│ Campaign         │ Spend    │ Clicks │ Conv. │ ROAS │ Status        │
├──────────────────────────────────────────────────────────────────────┤
│ Summer Promo     │ $800     │ 8,200  │ 56    │ 3.5x │ Active        │
│ Brand Awareness  │ $450     │ 4,250  │ 33    │ 2.8x │ Active        │
└──────────────────────────────────────────────────────────────────────┘
```

#### Kill Switch Settings

```
Budget Protection

┌──────────────────────────────────────────────────────────────────────┐
│ Max Daily Spend        │ [$50]           │ [Edit]                    │
│ Max Total Spend        │ [$500]          │ [Edit]                    │
│ Min Conversions        │ [0]             │ [Edit]                    │
│ Pause if ROAS <        │ [1.0]           │ [Edit]                    │
└──────────────────────────────────────────────────────────────────────┘

[ Save Settings ]

Status: ✅ Protection Active
Last check: 2 minutes ago
```

#### Recent Activity Log

```
Recent Activity

✅ 2 min ago — Campaign synced (56 conversions)
✅ 15 min ago — Budget check passed ($45/$50 daily)
✅ 1 hour ago — New conversion attributed ($42.50)
⚠️ 3 hours ago — ROAS dropped to 2.8x (threshold: 1.0)
✅ 6 hours ago — Campaign synced (52 conversions)
```

---

## 16. Download Feature

### Available Downloads

| File | Format | Description |
|------|--------|-------------|
| Campaign Report | CSV | Full campaign performance data |
| Analytics Export | CSV | Organic + Paid traffic breakdown |
| Invoice | PDF | Monthly billing statement |
| Conversion Log | CSV | All conversions with attribution |
| Tracking Links | CSV | All tracking URLs and stats |

### Download UI

**Location:** Top right of each dashboard section

```
[ Export ] dropdown menu
├── Download CSV (Campaign Report)
├── Download CSV (Analytics)
├── Download PDF (Invoice)
└── Custom Date Range...
```

### Custom Date Range Export

**Modal:**
```
Export Data

Date Range: [From: 2026-08-01] [To: 2026-08-20]

Data to Include:
☑️ Campaign Performance
☑️ Conversion Log
☑️ Traffic Sources
☑️ Revenue Breakdown

Format: [CSV ▼]

[ Export ]
```

### API Endpoint for Downloads

```
GET /api/internal/export?start=2026-08-01&end=2026-08-20&type=campaigns&format=csv
GET /api/internal/export?start=2026-08-01&end=2026-08-20&type=analytics&format=csv
GET /api/internal/export?start=2026-08-01&end=2026-08-20&type=conversions&format=csv
GET /api/internal/export?start=2026-08-01&end=2026-08-20&type=invoices&format=pdf
```

---

## 17. Updated Navigation Structure

### Business Dashboard Sidebar

```
Dashboard
├── Overview
├── Quick Stats
└── Recent Activity

Campaigns
├── All Campaigns
├── Create Campaign
└── Templates

Applicants
├── Pending
├── Accepted
└── Rejected

Analytics
├── Overview
├── Campaign Performance
├── Creator Performance
└── Traffic Sources

Google Ads                    <-- NEW SECTION
├── Dashboard
├── Campaigns
├── Kill Switch Settings
└── Activity Log

Tracking
├── Tracking Links
├── Pixel Setup
└── Domain Verification

Payments
├── Balance
├── Top Up
├── Cash Out
└── Transaction History

Plan
├── Current Plan
├── Upgrade
└── Billing

Messages
├── Inbox
├── Campaign Chats
└── Friend Requests

Settings
├── Profile
├── Notifications
├── Appearance
├── Integrations           <-- NEW
├── Security
└── Data Export
```

---

## 18. Updated Implementation Phases

### Phase 1: UI Only (Week 1)
- "Amplify" button on approved deliverables
- Setup modal with 3 inputs
- Draft/Launch split button
- Mock API responses
- **Integration dashboard UI**
- **Google Ads connection flow UI**
- **Google Ads dashboard layout**
- **Download/export buttons**

### Phase 2: Google Ads API Sandbox (Week 2)
- OAuth flow with Google
- Sandbox campaign creation
- Tracking template injection
- Parallel tracking compliance
- **Real OAuth integration**
- **Campaign selection from Google API**
- **Tracking template validation**

### Phase 3: Production Integration (Week 3)
- Live campaign creation
- Auto-kill switch with user thresholds
- Budget monitoring
- Notification system
- **Real-time sync with Google API**
- **Kill switch logic**
- **Export/download functionality**

### Phase 4: Analytics & Polish (Week 4)
- Blended ROAS dashboard
- A/B test asset extraction
- Google Partner credits setup
- Documentation
- **Full analytics with charts**
- **CSV/PDF export**
- **Activity logging**

---

## 19. Integration Dashboard Icons

### All Integration Cards with Icons

| Card | Icon | Status | Description |
|------|------|--------|-------------|
| Google Ads | 🔵 Google Ads logo | Not Connected | Amplify creator content with paid search & display ads |
| Meta Ads | 🔷 Meta/Facebook logo | Not Connected | Run ads on Facebook & Instagram feed, stories, reels |
| TikTok Ads | ⬛ TikTok logo | Not Connected | Promote creator content as native TikTok ads |
| YouTube Ads | 🔴 YouTube logo | Not Connected | Run pre-roll, discovery, and Shorts ads |
| Instagram Ads | 🟣 Instagram logo | Not Connected | Boost posts, stories, and reels as paid ads |
| Twitter/X Ads | ⬛ X/Twitter logo | Not Connected | Promote tweets and run timeline ads |
| LinkedIn Ads | 🔵 LinkedIn logo | Not Connected | B2B targeting and sponsored content |
| Pinterest Ads | 🔴 Pinterest logo | Not Connected | Promote pins and shopping ads |
| Snapchat Ads | 🟡 Snapchat logo | Not Connected | Run Snap ads and AR lens campaigns |
| Stripe | 🟣 Stripe logo | Connected | Payment processing and payouts |
| Resend | ✉️ Resend logo | Connected | Transactional email delivery |
| Supabase | 🟢 Supabase logo | Connected | Database, auth, and storage |
| Upstash | 🔴 Upstash logo | Connected | Redis rate limiting |
| Sightengine | 🟠 Sightengine logo | Connected | Content moderation and NSFW detection |

### Card States

#### Not Connected
```
┌─────────────────────────────────────────────────┐
│  [Icon]  Google Ads                             │
│                                                 │
│  Amplify your creator content with paid search  │
│  & display ads across Google's network.         │
│                                                 │
│  Status: ○ Not Connected                        │
│                                                 │
│  [ Add Google Ads ]                             │
└─────────────────────────────────────────────────┘
```
- Grey border
- Blue "Add" button

#### Connected
```
┌─────────────────────────────────────────────────┐
│  [Icon]  Google Ads                    ✅       │
│                                                 │
│  Amplify your creator content with paid search  │
│  & display ads across Google's network.         │
│                                                 │
│  Status: ● Connected                            │
│  Last synced: 2 minutes ago                     │
│  Campaigns: 3 active                            │
│                                                 │
│  [ Manage ]  [ Disconnect ]                     │
└─────────────────────────────────────────────────┘
```
- Green border with checkmark
- "Manage" and "Disconnect" buttons

#### Coming Soon
```
┌─────────────────────────────────────────────────┐
│  [Icon]  TikTok Ads                    🆕       │
│                                                 │
│  Promote creator content as native TikTok ads   │
│  with advanced audience targeting.              │
│                                                 │
│  Status: ◌ Coming Soon                          │
│  Expected: Q4 2026                              │
│                                                 │
│  [ Notify Me When Available ]                   │
└─────────────────────────────────────────────────┘
```
- Yellow border
- "Coming Soon" badge
- "Notify Me" button

---

## 20. Dashboard Icons (All Pages)

### Business Dashboard Sidebar

```
📊 Dashboard
📋 Campaigns
👥 Applicants
📈 Analytics
🎯 Google Ads           [Icon + Text]
🔗 Tracking
💳 Payments
⭐ Plan
💬 Messages
⚙️ Settings
```

### Creator Dashboard Sidebar

```
📊 Dashboard
📋 My Campaigns
🔍 Discover
💬 Messages
💰 Earnings
🎯 Analytics
🔗 Tracking
⭐ Plan
⚙️ Settings
```

### Each Page Header Icon

| Page | Icon | Title |
|------|------|-------|
| Dashboard | 📊 | Dashboard Overview |
| Campaigns | 📋 | Campaign Management |
| Analytics | 📈 | Analytics & Performance |
| Google Ads | 🎯 | Google Ads Integration |
| Tracking | 🔗 | Tracking & Attribution |
| Payments | 💳 | Payments & Balance |
| Plan | ⭐ | Your Plan |
| Messages | 💬 | Messages & Chat |
| Settings | ⚙️ | Settings |
| Earnings | 💰 | Earnings & Payouts |
| Discover | 🔍 | Discover Campaigns |

---

## 21. Hover Tooltips

### How It Works
- Every feature label has a small ℹ️ icon next to it
- On hover, a tooltip appears above explaining what it does
- Tooltip has a dark background with white text
- Disappears when mouse moves away

### Tooltip Examples

| Feature | Tooltip Text |
|---------|--------------|
| Commission % | The percentage of each sale you pay the creator. Higher % = more attractive to creators. |
| Fixed Amount | Flat fee paid to the creator per campaign, regardless of sales. |
| Attribution Days | How long after clicking a link a sale counts as a conversion. |
| Budget Cap | Maximum total spend for this campaign. Stops automatically when reached. |
| Tracking Link | A unique URL that tracks clicks and conversions from this campaign. |
| 7-Day Hold | Funds are held for 7 days after a sale to allow for refunds before paying the creator. |
| Balance | Your pre-paid wallet. Top up to run fixed-cost campaigns without linking a card each time. |
| Cash Out | Withdraw your balance to your bank account. 10% platform fee applies. |
| ROAS | Return On Ad Spend. How much revenue you get for every £1 spent on ads. |
| Kill Switch | Automatic budget protection. Pauses your ad campaign if it exceeds your spending limits. |
| Parallel Tracking | Google's required tracking method. Sends users to your page while tracking in the background. |
| Tier Badge | Your level on the platform. Higher tiers unlock more features and higher limits. |
| Verified Badge | Blue checkmark meaning your identity and social accounts have been verified by Adswish. |
| Gold Badge | Premium verification for creators with 1M+ followers on at least one platform. |
| Stripe Connect | Secure payment connection that allows you to receive payouts directly to your bank. |
| Pixel | A small piece of code on your website that tracks conversions from Adswish campaigns. |
| Deliverable | Content a creator must produce for a campaign (video, post, story, etc.). |
| SLA | Service Level Agreement. Rules for dispute resolution and campaign deadlines. |

---

## 22. Creator Profile Features

### Profile Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Avatar]  Sarah M.  ✅ Verified  ⭐ Gold Badge                    │
│            @sarahm_fitness                                          │
│            Fitness • Micro Creator                                  │
│            ⭐ 4.9 (127 reviews)                                    │
│                                                                     │
│  [ Website ]  [ Instagram ]  [ TikTok ]  [ YouTube ]               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Connected Channels                                                 │
│                                                                     │
│  🎵 TikTok        @sarahm_fitness    142K followers   ✅ Verified  │
│  📸 Instagram     @sarahm.fit        89K followers    ✅ Verified  │
│  🎬 YouTube       Sarah M Fitness    215K subscribers ✅ Verified  │
│  🌐 Website       sarahmfitness.com                  ✅ Active     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Recent Reviews                                                     │
│                                                                     │
│  ⭐⭐⭐⭐⭐  "Amazing content quality!" — Nike UK                    │
│            Campaign: Summer Fitness Bundle                          │
│            2 days ago                                               │
│                                                                     │
│  ⭐⭐⭐⭐⭐  "Very professional and on time." — GymShark            │
│            Campaign: Workout Series                                 │
│            1 week ago                                               │
│                                                                     │
│  ⭐⭐⭐⭐  "Great engagement rates." — Adidas                       │
│            Campaign: Running Collection                             │
│            2 weeks ago                                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Campaign History                                                   │
│                                                                     │
│  ✅ Completed: Summer Fitness Bundle (Nike)                        │
│  ✅ Completed: Workout Series (GymShark)                           │
│  ✅ Completed: Running Collection (Adidas)                         │
│  🔄 Active: Summer Promo 2026 (Puma)                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Profile Fields

| Field | Type | Required |
|-------|------|----------|
| Display Name | Text | Yes |
| Bio | Text (500 chars) | No |
| Profile Picture | Image Upload | No |
| Niche | Multi-select | Yes |
| Website URL | URL | No |
| TikTok URL | URL | No |
| Instagram URL | URL | No |
| YouTube URL | URL | No |
| Twitter/X URL | URL | No |
| Twitch URL | URL | No |
| Follower Count (TikTok) | Number | Auto-synced |
| Follower Count (Instagram) | Number | Auto-synced |
| Follower Count (YouTube) | Number | Auto-synced |
| Rating | Number (1-5) | Auto-calculated |
| Tier | Auto-calculated | Auto |

---

## 23. Friend System

### Add Friend Button

**When not friends:**
```
[ + Add Friend ]
```
- Blue button
- Shows username to the left: "sarah_mFitness"

**When friend request sent:**
```
[ ⏳ Request Sent ]
```
- Yellow/grey button
- Disabled state

**When friends:**
```
[ ✅ Added ]  [ 📋 Copy Username ]
```
- Green "Added" button (left)
- "Copy Username" button (right) — copies @username to clipboard

### Friend Request Flow

1. Business visits creator profile
2. Clicks "Add Friend" button
3. Button changes to "Request Sent"
4. Creator receives notification: "Nike UK wants to connect"
5. Creator accepts/declines
6. If accepted: both see "Added" + "Copy Username"
7. Both can now message each other

### Messages Integration

**When friends:**
```
[ 💬 Message ]
```
- Button appears on profile
- Opens chat in Messages section
- Full messaging with real-time updates

---

## 24. Plan Limits & Features

### Creator Plans

| Feature | Free | Pro (£5/mo) | Premium (£15/mo) |
|---------|------|-------------|------------------|
| Active Campaigns | 2 | 10 | 25 |
| Applications/24h | 5 | 15 | Unlimited |
| Payout Hold | 7 days | 5 days | 3 days |
| Minimum Payout | £25 | £20 | £15 |
| Instant Payout | ❌ | ✅ | ✅ |
| Priority Badge | ❌ | ✅ | ✅ |
| Gold Badge Eligible | ❌ | ✅ | ✅ |
| Verified Badge | ❌ | ✅ | ✅ |
| Saved Filters | 5 | Unlimited | Unlimited |
| Analytics | Basic | Advanced | Full |
| Support | Community | Email | Priority |

### Business Plans

| Feature | Free | Growth (£19/mo) | Enterprise (£49/mo) |
|---------|------|-----------------|---------------------|
| Active Campaigns | 3 | 10 | 25 |
| Creators per Campaign | 1 | 5 | Unlimited |
| Campaign Types | Fixed only | All types | All types |
| Tracking | Basic | Advanced | Full |
| Analytics | Basic | Advanced | Full |
| Google Ads Integration | ✅ | ✅ | ✅ |
| Support | Community | Email | Priority |
| Custom Branding | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ |

---

## 25. Verification Badges

### Badge Types

#### Blue Badge (Verified)
- ✅ Identity verified (ID upload)
- ✅ At least one social account connected
- ✅ 3-tier plan required (Pro for creators, Growth for businesses)
- Shows: ✅ Verified

#### Gold Badge (Premium Creator)
- ✅ All Blue Badge requirements
- ✅ 1M+ followers on at least ONE social platform
- ✅ Premium plan required
- Shows: ⭐ Gold Badge

### Verification Flow

**Step 1: Identity Verification**
1. Upload government ID (passport, driver's license)
2. Take selfie for liveness check
3. Admin reviews (24-48 hours)
4. Approved → identity_verified = true

**Step 2: Social Account Verification**
1. Connect TikTok/Instagram/YouTube via OAuth
2. Platform verifies follower count
3. At least one account must be active
4. social_verified = true

**Step 3: Plan Upgrade**
1. Subscribe to Pro (creators) or Growth (businesses)
2. plan_slug = 'creator_pro' or 'business_growth'
3. plan_verified = true

**Step 4: Badge Assignment**
- All 3 steps complete → Blue Badge assigned
- 1M+ followers + Premium plan → Gold Badge assigned

---

## 26. Email Verification Fix

### Current Problem
- Google sign-in creates account but verification email doesn't work
- "We sent a confirmation link" but link is broken

### Fix Required
1. **Google OAuth should bypass email verification**
   - If signing in with Google, account is already verified
   - Set email_confirmed_at = now() on signup
   - Skip verification email entirely

2. **Regular email signup should work**
   - Send verification email via Resend
   - Link should be: `https://adswish-lake.vercel.app/verify-email?token=xxx`
   - Token expires in 24 hours
   - On click: set email_confirmed_at = now()

3. **Post-signup flow**
   - If email confirmed → redirect to onboarding
   - If not confirmed → show "Please verify your email" page
   - Resend verification option available

---

## 27. Landing Page Updates

### Remove This Section
```
Creator Marketplace
Find your perfect creator match.
Browse the Adswish creator directory...
[Delete this entire section]
```

### Add These Sections Instead

#### Section 1: How It Works
```
How Adswish Works

For Businesses:
1. Create a campaign (fixed, affiliate, or hybrid)
2. Set your budget and requirements
3. Creators apply to your campaign
4. Approve creators and track performance
5. Pay only for results

For Creators:
1. Create your profile and connect social accounts
2. Browse available campaigns
3. Apply to campaigns that match your niche
4. Create content and submit deliverables
5. Get paid weekly via Stripe

[ Get Started as a Business ]  [ Join as a Creator ]
```

#### Section 2: Guides

```
📚 Guides & Tutorials

Business Guides:
├── 🚀 Launching Your First Campaign
├── 📊 Understanding Analytics
├── 💰 Managing Your Balance
├── 🔗 Setting Up Tracking
├── 🎯 Running Google Ads
└── 📈 Optimizing Campaign Performance

Creator Guides:
├── 🎬 Creating Great Content
├── 💰 Maximizing Your Earnings
├── 📊 Understanding Your Analytics
├── 🔗 How Tracking Works
├── ⭐ Getting Verified
└── 🏆 Leveling Up Your Tier

[ View All Guides ]
```

#### Section 3: Features

```
Why Choose Adswish?

✅ 10% Platform Fee — Lowest in the industry
✅ 7-Day Escrow Hold — Protected payments
✅ Real-Time Tracking — Pixel, S2S, UTM
✅ Integrations — Google Ads And More
✅ Auto-Kill Switch — Budget protection
✅ Blended Analytics — Organic + Paid data
✅ Verified Creators — Blue & Gold badges
✅ Instant Payouts — Available on Pro plans
✅ Multi-Platform — TikTok, Instagram, YouTube and even more!
✅ Free to Join — No upfront costs
```

---

## 28. Spelling & Grammar Fixes

| Original | Fixed |
|----------|-------|
| micro | Micro |
| mid | Mid |
| macro | Macro |
| buisness | Business |
| buinsees | Business |
| creaotrs | Creators |
| creaotr | Creator |
| intergration | Integration |
| dasboard | Dashboard |
| paln | Plan |
| feautre | Feature |
| feuares | Features |
| alding | Landing |
| seocd | Second |
| tilers | Tiers |
| msiktes | Mistakes |
| pelase | Please |
| alsof | Also for |
| tthikn | Think |
| laods | Loads |

---

## 29. Implementation Checklist

### Must Fix Now
- [ ] Google sign-in bypasses email verification
- [ ] Email verification link works
- [ ] Add Friend button shows username
- [ ] Copy Username button works (no 404)
- [ ] Friend messaging works
- [ ] Plan limits are enforced (Free: 2/3, Growth: 10, Premium: 25)
- [ ] Payout holds match plans (7/5/3 days)
- [ ] Verification badges work (Blue: 3-tier plan, Gold: 1M followers)
- [ ] Integration page shows all icons
- [ ] Dashboard shows icons next to text
- [ ] Hover tooltips on all features
- [ ] Creator profile shows reviews, followers, URLs
- [ ] Landing page guides section added
- [ ] Landing page Creator Marketplace section removed
- [ ] Spelling mistakes fixed

### Build After
- [ ] Google Ads integration (Phase 1-4)
- [ ] Meta Ads integration
- [ ] TikTok Ads integration
- [ ] YouTube Ads integration
- [ ] More integrations with "Coming Soon" badges
- [ ] Tutorial system
- [ ] Advanced analytics charts
- [ ] CSV/PDF export

---

## 30. Auto-Logout & Session Timeout

### Browser Back Button Logout
- When user presses back/forward in browser on dashboard
- Detect navigation away from dashboard routes
- Auto-logout and redirect to landing page
- Show message: "Session has timed out. Please sign in again."

### Inactivity Timeout
- Default: 1 minute of no interaction → auto-logout
- Configurable in Settings: 1 min, 5 min, 10 min, 30 min, Never
- Interaction = click, scroll, keypress, mousemove
- Timer resets on every interaction
- Warning at 30 seconds before timeout: "You will be logged out in 30 seconds"
- On timeout: clear session, redirect to login, show message

### Settings UI
```
Session Timeout

Automatically log you out after a period of inactivity.

Current: [ 1 minute ▼ ]

Options:
├── 1 minute (default)
├── 5 minutes
├── 10 minutes
├── 30 minutes
└── Never (not recommended)

[ Save ]

⚠️ For security, we recommend keeping this under 10 minutes.
```

---

## 31. Example Campaigns (Conditional)

### Rules
- Only show example campaigns if 100+ active campaigns exist
- If fewer than 100 active campaigns → hide entire section
- When shown, clicking an example opens the real campaign page
- Examples rotate dynamically from live data

### Landing Page Behavior

**If < 100 active campaigns:**
```
[ Entire example campaigns section is invisible ]
```

**If 100+ active campaigns:**
```
Live Campaigns

See what businesses are running right now.

┌─────────────────────────────────────────────────────────────────────┐
│  Summer Fitness Bundle                               Fixed • £200   │
│  Nike UK • Fitness • 5 creators needed                          │
│  [ Apply Now ]                                                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Workout Series                                    Affiliate • 15%  │
│  GymShark • Lifestyle • 3 creators needed                       │
│  [ Apply Now ]                                                    │
└─────────────────────────────────────────────────────────────────────┘

[ View All Campaigns ]
```

---

## 32. Landing Page Final Structure

### Section Order

```
1. Hero
   "Launch winning creator campaigns"
   "A marketplace for businesses and creators"
   [ Get Started as a Business ]  [ Join as a Creator ]

2. How It Works
   01. Post a campaign — Set your terms (fixed, affiliate, or hybrid)
   02. Creators apply — Filtered by tier, niche, and rating
   03. Approve each video — Lock-and-key deliverables, one slot at a time
   04. Sales track, creators get paid — Escrow releases automatically after 7 days

3. Live Campaigns (only if 100+ active)
   Real campaigns from real businesses
   [Dynamic list]

4. For Businesses
   Features, pricing, dashboard preview
   [ Get Started as a Business ]

5. For Creators
   Features, pricing, profile preview
   [ Join as a Creator ]

6. Tracking & Pixel
   Pixel active — One line of code, or zero
   Chrome extension — Attribution without touching your site

7. Guides & Tutorials
   Business guides, Creator guides

8. Pricing
   Plan comparison table

9. Testimonials
   Real reviews from businesses and creators

10. Footer
    Legal, social links, contact
```

### Removed Sections
- ❌ "Adswish Tools" section (replaced with "How It Works")
- ❌ "Creator Marketplace" section (removed entirely)
- ❌ Standalone tools list (moved to guides)

---

## 33. Pixel & Chrome Extension (Under Lock & Key)

### Lock & Key Section Content

```
Lock & Key

Sequential deliverable slots ensure creators deliver content in order.
Each slot is locked until the previous one is approved.

How it works:
1. Business creates campaign with X deliverables
2. Creator applies and gets accepted
3. Slot 1 unlocks — creator produces content
4. Business approves → Slot 2 unlocks
5. Process repeats until all slots complete
6. Escrow releases payment after final approval
```

### Pixel Section (Below Lock & Key)

```
Pixel Active

One line of code — or zero.

Drop the pixel script, GTM container, or Shopify embed on your site — or install the Adswish Chrome extension and track conversions with zero site code. Edge-redirected links survive ad blockers either way.

[ Copy snippet ]  [ GTM template ]  [ Chrome extension ]

<script src="https://adswish.com/pixel.js" ></script>
```

### Chrome Extension Section (Below Pixel)

```
Adswish Tracker — Chrome Extension

Attribution without touching your site.

No script tags, no GTM, no developer. Install the extension, connect your business, and conversions get attributed automatically.

1. Install the extension
   Load it from the Chrome Web Store (or unpacked from chrome://extensions in dev).

2. Connect your business
   Paste your API URL and Business ID from Settings → Tracking into the extension options.

3. Track automatically
   It captures your /t/ links, heartbeats your pixel, and fires conversions — zero site code.

[ Get it on the Chrome Web Store ]

Settings → Tracking
```

---

## 34. Spelling Fixes (Complete)

| Original | Fixed |
|----------|-------|
| micro | Micro |
| mid | Mid |
| macro | Macro |
| buisness | Business |
| buinsees | Business |
| creaotrs | Creators |
| creaotr | Creator |
| intergration | Integration |
| dasboard | Dashboard |
| paln | Plan |
| feautre | Feature |
| feuares | Features |
| alding | Landing |
| seocd | Second |
| tilers | Tiers |
| msiktes | Mistakes |
| pelase | Please |
| alsof | Also for |
| tthikn | Think |
| laods | Loads |
| ealve | Leave |
| dabord | Dashboard |
| prormpt | Prompt |
| cahnged | Changed |
| exmaple | Example |
| camapgins | Campaigns |
| emaple | Example |
| cmaaign | Campaign |
| aprt | Part |
| mvoe | Move |
| lcok | Lock |
| udre | Under |
| prormtrt | Prompt |
| speelnig | Spelling |
| prormpt | Prompt |

---

## 35. Implementation Priority

### Immediate (This Week)
- [ ] Auto-logout on browser back button
- [ ] 1-minute inactivity timeout (configurable)
- [ ] Session timeout settings page
- [ ] Example campaigns hidden if < 100 active
- [ ] Remove "Adswish Tools" section from landing page
- [ ] Add "How It Works" section to landing page
- [ ] Move Pixel/Extension content under Lock & Key
- [ ] Fix all spelling mistakes
- [ ] Google sign-in bypasses email verification
- [ ] Add Friend button shows username (no 404)
- [ ] Friend messaging works

### Next Week
- [ ] Plan limits enforced (Free: 2/3, Growth: 10, Premium: 25)
- [ ] Payout holds match plans (7/5/3 days)
- [ ] Verification badges work
- [ ] Integration page with all icons
- [ ] Dashboard icons on all pages
- [ ] Hover tooltips on all features
- [ ] Creator profile shows reviews, followers, URLs

### Following Weeks
- [ ] Google Ads integration (Phase 1-4)
- [ ] Meta Ads integration
- [ ] TikTok Ads integration
- [ ] YouTube Ads integration
- [ ] More integrations with "Coming Soon" badges
- [ ] Tutorial system
- [ ] Advanced analytics charts
- [ ] CSV/PDF export
