// Remove the demo/fake data seeded by scripts/seed-demo-data.mjs so the live
// site shows only real user data. Keeps the two test accounts themselves.
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SR = env.SUPABASE_SERVICE_ROLE_KEY;
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];

async function adminUsers() {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: SR, Authorization: `Bearer ${SR}` },
  });
  return (await r.json()).users ?? [];
}
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

const users = await adminUsers();
const business = users.find((u) => u.email === "willgreer38@gmail.com");
const creator = users.find((u) => u.email === "wgreer301@gmail.com");

if (business) {
  await sql(`DELETE FROM campaigns WHERE business_id = '${business.id}';`);
  await sql(`DELETE FROM reviews WHERE reviewer_id = '${business.id}' OR reviewee_id = '${business.id}';`);
  await sql(`DELETE FROM balance_transactions WHERE business_id = '${business.id}';`);
  await sql(`UPDATE business_profiles SET bio = '', average_rating = 0 WHERE user_id = '${business.id}';`);
}
if (creator) {
  await sql(`DELETE FROM daily_conversion_rollups WHERE creator_id = '${creator.id}';`);
  await sql(`DELETE FROM applications WHERE creator_id = '${creator.id}';`);
  await sql(`DELETE FROM creator_social_accounts WHERE creator_id = '${creator.id}';`);
  await sql(`DELETE FROM reviews WHERE reviewer_id = '${creator.id}' OR reviewee_id = '${creator.id}';`);
  await sql(`UPDATE creator_profiles SET bio = '', niches = '{}', tier = 'micro', average_rating = 0 WHERE user_id = '${creator.id}';`);
}
await sql("DELETE FROM notifications WHERE body LIKE '%review%' OR body LIKE '%smoke%';");

console.log("Demo data removed. Accounts kept:");
console.log(`  business ${business?.email} (${business?.id})`);
console.log(`  creator  ${creator?.email} (${creator?.id})`);
