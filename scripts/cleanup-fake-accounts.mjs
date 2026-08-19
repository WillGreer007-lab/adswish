// Delete the fake/test accounts the user named: businesses "sdadadad" + "ddfsf"
// and creators "Sarah" + "davis", plus the obvious "creator@test.com".
// Uses the Supabase Auth Admin API (service role). All profile/campaign/app data
// cascades via ON DELETE CASCADE from auth.users.
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const ref = url.replace(/^https?:\/\//, "").split(".")[0];
const base = `https://${ref}.supabase.co/auth/v1/admin/users`;

const targets = [
  { id: "9bfc8eb6-90f6-4699-a1d0-d21490241043", label: "business ddfsf (willgreer38@gmail.com)" },
  { id: "b229a299-f0b5-4fdd-a661-430bcb53523e", label: "business sdadadad (willgreer2025@gmail.com)" },
  { id: "67c1d3cc-75cb-4f57-a35f-831aa96ed8d6", label: "creator davis (wgreer301@gmail.com)" },
  { id: "ef091dea-0ba0-4ef3-a72d-8534cd63c5b5", label: "creator Sarah (willgreer007@icloud.com)" },
  { id: "e223497f-7e14-4a1f-b2e2-9a5661c33932", label: "orphan auth user creator@test.com" },
];

console.log("About to delete these auth users (cascades remove all their data):");
for (const t of targets) console.log(`  - ${t.label}`);

for (const t of targets) {
  const res = await fetch(`${base}/${t.id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${serviceRole}`,
      apikey: serviceRole,
      "Content-Type": "application/json",
    },
  });
  console.log(`${res.status === 200 ? "✓" : "✘"} ${res.status} deleted ${t.label}`);
  if (res.status !== 200) {
    console.log(await res.text());
  }
}

console.log("\nDone. Verification (profiles should be empty):");
// Verify via Management API.
const token = env.SUPABASE_ACCESS_TOKEN;
async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return r.json();
}
console.log("business_profiles:", JSON.stringify(await q("select user_id, company_name from business_profiles;")));
console.log("creator_profiles:", JSON.stringify(await q("select user_id, display_name from creator_profiles;")));
