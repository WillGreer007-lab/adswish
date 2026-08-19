// Read-only diagnostic: which businesses would show a green "in-house" tracking tick?
// Uses the Supabase Management API (SQL) — no writes.
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const token = env.SUPABASE_ACCESS_TOKEN;
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const ref = url.replace(/^https?:\/\//, "").split(".")[0];

async function q(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return res.json();
}

const profiles = await q(`
  select user_id, company_name, verified_domain, onboarding_step, stripe_customer_id
  from business_profiles
  order by created_at desc
  limit 20;
`);
console.log("=== business_profiles ===");
for (const p of profiles) {
  console.log(JSON.stringify(p));
}

const links = await q(`
  select tl.id, tl.slug, tl.revoked_at, c.title as campaign, c.business_id
  from tracking_links tl
  join campaigns c on c.id = tl.campaign_id
  order by tl.created_at desc
  limit 30;
`);
console.log("\n=== tracking_links ===");
for (const l of links) {
  console.log(JSON.stringify(l));
}

const clicks = await q(`
  select tracking_link_id, count(*)::int as clicks, max(clicked_at) as last_click
  from clicks_log
  group by tracking_link_id
  order by last_click desc
  limit 30;
`);
console.log("\n=== clicks_log (by link) ===");
for (const c of clicks) {
  console.log(JSON.stringify(c));
}

const pixels = await q(`
  select id, title, business_id, pixel_status, last_pixel_ping_at, status
  from campaigns
  order by created_at desc
  limit 30;
`);
console.log("\n=== campaigns (pixel) ===");
for (const c of pixels) {
  console.log(JSON.stringify(c));
}
