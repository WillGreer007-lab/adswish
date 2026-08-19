// Seed realistic demo data on the two clean test accounts so the directories,
// dashboards, and analytics charts have something to render:
//   - business: willgreer38@gmail.com (GreerCo)
//   - creator:  wgreer301@gmail.com (Will Greer)
// Idempotent: deletes prior seed rows for these two users first.
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SR = env.SUPABASE_SERVICE_ROLE_KEY;
const ref = URL.replace(/^https?:\/\//, "").split(".")[0];

async function adminListUsers() {
  const r = await fetch(`${URL}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: SR, Authorization: `Bearer ${SR}` },
  });
  return (await r.json()).users ?? [];
}
async function rest(table, method, body, opts = {}) {
  const headers = {
    apikey: SR,
    Authorization: `Bearer ${SR}`,
    "Content-Type": "application/json",
    ...(opts.prefer ? { Prefer: opts.prefer } : {}),
  };
  const r = await fetch(`${URL}/rest/v1/${table}${opts.qs ?? ""}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return r;
}
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

const users = await adminListUsers();
const business = users.find((u) => u.email === "willgreer38@gmail.com");
const creator = users.find((u) => u.email === "wgreer301@gmail.com");
if (!business || !creator) {
  console.error("Test accounts not found — run scripts/create-test-accounts.mjs first.");
  process.exit(1);
}
console.log(`business=${business.id} creator=${creator.id}`);

// 1) Clear any prior seed rows for these two.
await sql(`DELETE FROM daily_conversion_rollups WHERE creator_id = '${creator.id}';`);
await sql(`DELETE FROM reviews WHERE reviewer_id IN ('${business.id}','${creator.id}') OR reviewee_id IN ('${business.id}','${creator.id}');`);
await sql(`DELETE FROM applications WHERE creator_id = '${creator.id}';`);
await sql(`DELETE FROM campaigns WHERE business_id = '${business.id}';`);
await sql(`DELETE FROM creator_social_accounts WHERE creator_id = '${creator.id}';`);

// 2) Profiles.
await rest("business_profiles", "PATCH", {
  bio: "Independent UK brand running creator campaigns across fitness, tech, and beauty.",
  average_rating: 4.6,
}, { qs: `?user_id=eq.${business.id}` });
await rest("creator_profiles", "PATCH", {
  bio: "Fitness & lifestyle creator. 25k on YouTube, posting workouts and honest product reviews.",
  niches: ["Fitness", "Lifestyle", "Tech"],
  tier: "mid",
  average_rating: 4.9,
}, { qs: `?user_id=eq.${creator.id}` });

// 3) Social accounts (follower counts for the directory).
for (const [platform, handle, followers] of [
  ["youtube", "@willgreerfitness", 25000],
  ["instagram", "@willgreer.fit", 12400],
  ["tiktok", "@willgreer.fit", 48000],
]) {
  const r = await rest("creator_social_accounts", "POST", {
    creator_id: creator.id, platform, handle, follower_count: followers, verified_at: new Date().toISOString(),
  });
  if (!r.ok) console.error("social", platform, await r.text());
}

// 4) Campaigns.
const campaigns = [
  { title: "Summer Glow Collection", type: "fixed", fixed_amount: 500, commission_pct: null, niche: ["Beauty", "Fitness"], status: "active" },
  { title: "Tech Launch — Smart Home", type: "affiliate", fixed_amount: null, commission_pct: 15, niche: ["Tech", "Smart Home"], status: "active" },
  { title: "Fitness Bundle Boost", type: "hybrid", fixed_amount: 200, commission_pct: 10, niche: ["Fitness", "Lifestyle"], status: "active" },
];
const campaignIds = [];
for (const c of campaigns) {
  const r = await rest("campaigns", "POST", {
    business_id: business.id, ...c, attribution_days: c.type === "fixed" ? null : 30,
    deliverable_count: 1, currency: "GBP", end_date: new Date(Date.now() + 21 * 864e5).toISOString(),
    pixel_status: c.type === "fixed" ? "unverified" : "active",
    last_pixel_ping_at: c.type === "fixed" ? null : new Date().toISOString(),
  }, { prefer: "return=representation" });
  const data = await r.json();
  if (!r.ok) { console.error("campaign", c.title, await r.text()); continue; }
  const row = Array.isArray(data) ? data[0] : data;
  campaignIds.push({ id: row.id, type: c.type });
  console.log(`campaign "${c.title}" -> ${row.id}`);
}

// 5) Applications (pending for two, accepted for one).
for (let i = 0; i < campaignIds.length; i++) {
  const { id, type } = campaignIds[i];
  const status = i === 0 ? "accepted" : "pending";
  const r = await rest("applications", "POST", {
    campaign_id: id, creator_id: creator.id, status, tier_at_application: "mid", applied_at: new Date().toISOString(),
  });
  if (!r.ok) console.error("application", id, await r.text());
}

// 6) Reviews (so average_rating + directory stars show).
await rest("reviews", "POST", {
  reviewer_id: business.id, reviewee_id: creator.id, campaign_id: campaignIds[0]?.id,
  rating_out_of_5: 5, written_feedback: "Fantastic content — the post drove real sales.",
});
await rest("reviews", "POST", {
  reviewer_id: creator.id, reviewee_id: business.id, campaign_id: campaignIds[0]?.id,
  rating_out_of_5: 4, written_feedback: "Clear brief and prompt payout.",
});

// 7) Daily rollups for the last 14 days → feeds the analytics charts.
const now = new Date();
for (let d = 13; d >= 0; d--) {
  const day = new Date(now.getTime() - d * 864e5);
  const date = day.toISOString().slice(0, 10);
  for (const { id } of campaignIds) {
    const clicks = 20 + Math.floor(Math.random() * 80);
    const conversions = Math.max(1, Math.floor(clicks * (0.03 + Math.random() * 0.05)));
    const gross = Math.round(conversions * (30 + Math.random() * 60));
    const creatorCut = Math.round(gross * 0.9);
    const platformCut = gross - creatorCut;
    const r = await rest("daily_conversion_rollups", "POST", {
      campaign_id: id, creator_id: creator.id, date,
      total_clicks: clicks, total_conversions: conversions,
      gross_sales: gross, creator_cut: creatorCut, platform_cut: platformCut,
    });
    if (!r.ok) console.error("rollup", id, date, await r.text());
  }
}

console.log("\nSeed complete. Directories + analytics now have data.");
