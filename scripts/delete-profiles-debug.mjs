import { readFileSync } from "node:fs";
const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.NEXT_PUBLIC_SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, text: await r.text() };
}

for (const [tbl, col, id] of [
  ["business_profiles", "user_id", "b229a299-f0b5-4fdd-a661-430bcb53523e"],
  ["creator_profiles", "user_id", "ef091dea-0ba0-4ef3-a72d-8534cd63c5b5"],
]) {
  const r = await q(`DELETE FROM ${tbl} WHERE ${col} = '${id}';`);
  console.log(`DELETE ${tbl} ${id} -> ${r.status}`);
  console.log(r.text.slice(0, 800));
  console.log("---");
}
