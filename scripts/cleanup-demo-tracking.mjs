// Remove demo/fixture tracking data that was making the "in-house tracking"
// check show green when the business had done nothing. Deletes:
//   - the "Demo tracking link — try the extension" campaign
//   - its tracking_links + clicks_log rows
// Uses the Supabase Management API (SQL). Writes are limited to demo fixtures.
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
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return text;
}

const DEMO_TITLE = "Demo tracking link — try the extension";

console.log("Deleting demo tracking links + clicks…");
await q(`
  DELETE FROM clicks_log
  WHERE tracking_link_id IN (
    SELECT tl.id FROM tracking_links tl
    JOIN campaigns c ON c.id = tl.campaign_id
    WHERE c.title = '${DEMO_TITLE}'
  );
`);
await q(`
  DELETE FROM tracking_links
  WHERE campaign_id IN (
    SELECT id FROM campaigns WHERE title = '${DEMO_TITLE}'
  );
`);
console.log("Deleting demo campaign…");
await q(`DELETE FROM campaigns WHERE title = '${DEMO_TITLE}';`);

console.log("\nDone. Remaining tracking_links:");
const links = await q(`
  SELECT tl.id, tl.slug, tl.revoked_at, c.title, c.business_id
  FROM tracking_links tl JOIN campaigns c ON c.id = tl.campaign_id
  ORDER BY tl.created_at DESC;
`);
console.log(links === "" ? "(none)" : links);
