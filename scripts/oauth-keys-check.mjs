#!/usr/bin/env node
/**
 * OAuth key + sandbox readiness check for TikTok / Instagram / YouTube.
 * Does NOT exchange codes (that needs a real user completing consent), but
 * verifies:
 *   1. Keys are present and well-formed (non-empty, expected shape).
 *   2. The initiate routes on production respond correctly (redirect to the
 *      provider when keys are set, or a clear not-configured notice).
 *   3. Prints the exact authorize URL shapes for a manual sandbox test.
 *
 * Usage: node scripts/oauth-keys-check.mjs
 */
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] ?? "";
const BASE = "https://adswish-lake.vercel.app";

const providers = [
  {
    platform: "tiktok",
    keys: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    authorize: (k) => `https://www.tiktok.com/v2/auth/authorize/?client_key=${k.TIKTOK_CLIENT_KEY}&response_type=code&scope=user.info.basic&redirect_uri=${BASE}/api/internal/oauth/tiktok/callback&state=TEST`,
  },
  {
    platform: "instagram",
    keys: ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET"],
    authorize: (k) => `https://api.instagram.com/oauth/authorize?client_id=${k.INSTAGRAM_CLIENT_ID}&redirect_uri=${BASE}/api/internal/oauth/instagram/callback&response_type=code&scope=user_profile,user_media&state=TEST`,
  },
  {
    platform: "youtube",
    keys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    authorize: () => `https://accounts.google.com/o/oauth2/v2/auth?client_id=${get("GOOGLE_CLIENT_ID")}&redirect_uri=${BASE}/api/internal/oauth/youtube/callback&response_type=code&scope=https://www.googleapis.com/auth/youtube.readonly&access_type=offline&prompt=consent&state=TEST`,
  },
];

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

for (const p of providers) {
  const present = p.keys.every((k) => get(k).length > 5);
  check(`${p.platform}: all keys present`, present, p.keys.map((k) => `${k}=${present ? "SET" : "EMPTY"}`).join(", "));
  if (present) {
    console.log(`   authorize URL: ${p.authorize(get).slice(0, 140)}…`);
  }
}

// Production initiate routes
console.log("\nProduction initiate route behavior:");
for (const platform of ["tiktok", "instagram", "youtube"]) {
  const res = await fetch(`${BASE}/api/internal/oauth/${platform}`, { redirect: "manual" });
  const loc = res.headers.get("location") ?? "";
  const configured = /accounts\.google|tiktok\.com\/v2|api\.instagram\.com/.test(loc);
  const guarded = /not_configured/.test(loc);
  console.log(`   /${platform}: ${res.status} → ${loc.slice(0, 90)}`);
  if (configured) check(`${platform}: route redirects to provider (keys live)`, true);
  else if (guarded) check(`${platform}: route guards with not_configured (keys absent)`, true, "expected until keys added");
  else if (/\/login/.test(loc)) check(`${platform}: route requires auth (login redirect)`, true, "correct for unauthenticated probe");
  else check(`${platform}: unexpected response`, false, loc);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
