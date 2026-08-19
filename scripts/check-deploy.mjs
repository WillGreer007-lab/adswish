// Post-push deploy health check.
//
// Usage: node scripts/check-deploy.mjs [url]
//   (default url: https://adswish-lake.vercel.app)
//
// Verifies the live site is up and the key public routes return 200. Run this
// after every push to confirm the Vercel build finished and the site is
// healthy. If a VERCEL_TOKEN + VERCEL_PROJECT_ID are present in the env it also
// prints the last deployment state; without them it does the HTTP checks only.
import { readFileSync } from "node:fs";

const env = {};
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
} catch {
  // .env.local optional — the script also works with plain env vars.
}

const BASE = process.argv[2] ?? "https://adswish-lake.vercel.app";
const routes = ["/", "/plans", "/businesses", "/creators", "/login", "/signup"];

let failures = 0;
console.log(`Checking ${BASE}\n`);
for (const route of routes) {
  try {
    const res = await fetch(`${BASE}${route}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "Adswish-Deploy-Check/1.0" },
    });
    const ok = res.status === 200;
    if (!ok) failures++;
    console.log(`${ok ? "✓" : "✗"} ${route} -> ${res.status}`);
  } catch (e) {
    failures++;
    console.log(`✗ ${route} -> unreachable (${e.message})`);
  }
}

// Vercel API (only if a token is configured).
const token = env.VERCEL_TOKEN;
const projectId = env.VERCEL_PROJECT_ID;
if (token && projectId) {
  try {
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1&state=READY`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    const latest = data?.deployments?.[0];
    console.log(`\nLatest Vercel deployment: ${latest?.url ?? "n/a"} (${latest?.state ?? "unknown"})`);
  } catch (e) {
    console.log(`\n⚠️  Could not reach Vercel API: ${e.message}`);
  }
} else {
  console.log("\n(no VERCEL_TOKEN/VERCEL_PROJECT_ID set — HTTP checks only)");
}

console.log(`\n${failures === 0 ? "✅ Live site healthy." : `❌ ${failures} route(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
