// Apply a migration .sql file to the cloud Supabase project via the Management API.
// Usage: node scripts/apply-migration.mjs supabase/migrations/024_profile_images.sql
// Requires SUPABASE_ACCESS_TOKEN + NEXT_PUBLIC_SUPABASE_URL in .env.local.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const token = env.SUPABASE_ACCESS_TOKEN;
const url = env.NEXT_PUBLIC_SUPABASE_URL;
if (!token || !url) {
  console.error("Missing SUPABASE_ACCESS_TOKEN or NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}
const ref = url.replace(/^https?:\/\//, "").split(".")[0];

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.error("Usage: node scripts/apply-migration.mjs <path-to-migration.sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
// Strip comment blocks, then split on statements terminated by ';'.
const statements = sql
  .replace(/--[^\n]*/g, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`Applying ${file} (${statements.length} statements) to project ${ref}…`);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: stmt }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`\n✘ Statement ${i + 1} failed (${res.status}):`);
    console.error(stmt.slice(0, 200));
    console.error(text);
    process.exit(1);
  }
  console.log(`✓ Statement ${i + 1}/${statements.length} ok`);
}

console.log(`\nDone — ${file} applied.`);
