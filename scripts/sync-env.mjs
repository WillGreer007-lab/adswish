/**
 * Copy runtime-needed keys from .env.local into vercel-env.txt (the production
 * env list). Only copies keys that already have a value locally AND are needed
 * by the app at runtime. Never prints values. Skips local-only/management keys
 * (SUPABASE_ACCESS_TOKEN, VERCEL_OIDC_TOKEN) which must NOT ship to Vercel.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

// Runtime keys the app reads from process.env, that belong in production.
const RUNTIME_KEYS = [
  "JWT_SIGNING_SECRET",
  "MESSAGE_ENCRYPTION_KEY",
  "NEXT_PUBLIC_APP_DOMAIN",
  "SUPABASE_JWKS_URL",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REDIRECT_URI",
];

function parse(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const local = parse(".env.local");
const target = parse("vercel-env.txt");

let added = 0, updated = 0, skipped = 0;
for (const key of RUNTIME_KEYS) {
  const value = local[key];
  if (!value) { skipped++; continue; }
  if (target[key] === value) { skipped++; continue; }
  if (target[key] === undefined) added++;
  else updated++;
  target[key] = value;
}

// Rebuild vercel-env.txt, preserving any comment lines we can.
const existingLines = existsSync("vercel-env.txt")
  ? readFileSync("vercel-env.txt", "utf8").split("\n").filter((l) => l.startsWith("#") || l.trim() === "")
  : [];
const body = [];
for (const [k, v] of Object.entries(target).sort()) {
  body.push(`${k}=${v}`);
}
const header = existingLines.join("\n");
const output = (header ? header + "\n" : "") + body.join("\n") + "\n";
writeFileSync("vercel-env.txt", output);

console.log(`Sync complete: ${added} added, ${updated} updated, ${skipped} unchanged/skipped.`);
console.log("vercel-env.txt now has", body.length, "entries.");
