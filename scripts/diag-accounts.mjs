// Read-only: list all business + creator profiles and their auth emails.
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

const businesses = await q(`
  select user_id, company_name, onboarding_step, created_at
  from business_profiles order by created_at;
`);
const creators = await q(`
  select user_id, display_name, tier, onboarding_step, created_at
  from creator_profiles order by created_at;
`);
const users = await q(`
  select id, email, created_at
  from auth.users order by created_at;
`);

console.log("=== business_profiles ===");
for (const b of businesses) {
  const u = users.find((x) => x.id === b.user_id);
  console.log(JSON.stringify({ ...b, email: u?.email }));
}
console.log("\n=== creator_profiles ===");
for (const c of creators) {
  const u = users.find((x) => x.id === c.user_id);
  console.log(JSON.stringify({ ...c, email: u?.email }));
}
console.log("\n=== auth.users (no profile) ===");
const profiled = new Set([...businesses.map((b) => b.user_id), ...creators.map((c) => c.user_id)]);
for (const u of users) {
  if (!profiled.has(u.id)) console.log(JSON.stringify(u));
}
