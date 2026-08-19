// Remove orphaned test leftovers that reference no real data:
//   - ledger_entries with related_conversion_id IS NULL (old E2E artifacts)
//   - webhook_events rows (old test deliveries; there are no real events yet)
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.NEXT_PUBLIC_SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

await sql("DELETE FROM ledger_entries WHERE related_conversion_id IS NULL;");
await sql("DELETE FROM webhook_events;");
console.log("Purged orphaned ledger entries + stale webhook events.");
