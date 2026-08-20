#!/usr/bin/env node
/**
 * Apply a migration file to the cloud Supabase DB via the Management API.
 *
 * Usage: node scripts/apply-migration.mjs supabase/migrations/NNN_name.sql
 *
 * Reads SUPABASE_ACCESS_TOKEN (+ SUPABASE_PROJECT_REF, defaulting to the
 * project in NEXT_PUBLIC_SUPABASE_URL) from .env.local. Never prints secrets.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const envPath = join(process.cwd(), ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const token = env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN missing from .env.local");
  process.exit(1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
const ref = env.SUPABASE_PROJECT_REF || (url.match(/https:\/\/([^.]+)\.supabase\.co/) || [])[1];
if (!ref) {
  console.error("Could not determine project ref (set SUPABASE_PROJECT_REF)");
  process.exit(1);
}

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.error(`Usage: node scripts/apply-migration.mjs <path-to.sql> (missing: ${file})`);
  process.exit(1);
}
const query = readFileSync(file, "utf8");

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`Migration FAILED (${res.status}): ${text.slice(0, 2000)}`);
  process.exit(1);
}
console.log(`Migration applied to project ${ref} (${file})`);
if (text && text !== "[]") console.log(text.slice(0, 1000));
