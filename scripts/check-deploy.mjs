// Post-push deploy health check.
//
// Usage: node scripts/check-deploy.mjs [url]
//   (default url: https://adswish-lake.vercel.app)
//
// The public route checks always run. If VERCEL_TOKEN is configured in
// .env.local (or the process environment), the script also queries Vercel for
// the latest production deployment and reports its build state and URL.
// VERCEL_PROJECT_ID/VERCEL_ORG_ID are optional when this checkout is linked:
// they are read from .vercel/project.json automatically.
import { readFileSync } from "node:fs";

function loadEnvFile() {
  const values = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) {
        values[match[1]] = match[2]
          .trim()
          .replace(/^['"]|['"]$/g, "");
      }
    }
  } catch {
    // .env.local is optional — the script also works with process env vars.
  }
  return values;
}

function loadVercelProject() {
  try {
    return JSON.parse(readFileSync(".vercel/project.json", "utf8"));
  } catch {
    return {};
  }
}

const fileEnv = loadEnvFile();
const project = loadVercelProject();
const getEnv = (name) => process.env[name] || fileEnv[name] || "";

const BASE = (process.argv[2] ?? "https://adswish-lake.vercel.app").replace(/\/$/, "");
const routes = ["/", "/plans", "/businesses", "/creators", "/login", "/signup"];

let failures = 0;
console.log(`Checking ${BASE}\n`);
for (const route of routes) {
  try {
    const res = await fetch(`${BASE}${route}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "Adswish-Deploy-Check/2.0" },
    });
    const ok = res.status === 200;
    if (!ok) failures++;
    console.log(`${ok ? "✓" : "✗"} ${route} -> ${res.status}`);
  } catch (error) {
    failures++;
    console.log(`✗ ${route} -> unreachable (${error.message})`);
  }
}

const token = getEnv("VERCEL_TOKEN");
const projectId = getEnv("VERCEL_PROJECT_ID") || project.projectId;
const teamId = getEnv("VERCEL_ORG_ID") || project.orgId;

if (token && projectId) {
  const apiUrl = new URL("https://api.vercel.com/v6/deployments");
  apiUrl.searchParams.set("projectId", projectId);
  apiUrl.searchParams.set("target", "production");
  apiUrl.searchParams.set("limit", "5");
  if (teamId) apiUrl.searchParams.set("teamId", teamId);

  try {
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "Adswish-Deploy-Check/2.0",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      failures++;
      console.log(`\n✗ Vercel API -> HTTP ${res.status} (deployment state unavailable)`);
    } else {
      const data = await res.json();
      const latest = data?.deployments?.[0];
      if (!latest) {
        failures++;
        console.log("\n✗ Vercel API -> no production deployment found");
      } else {
        const deployUrl = latest.url ? `https://${latest.url}` : "n/a";
        const state = latest.state || "UNKNOWN";
        const commit = latest.meta?.githubCommitSha
          ? ` commit ${latest.meta.githubCommitSha.slice(0, 8)}`
          : "";
        console.log(`\nVercel production deployment: ${state}${commit}`);
        console.log(`Deploy URL: ${deployUrl}`);
        if (latest.target) console.log(`Target: ${latest.target}`);
        if (latest.createdAt) {
          console.log(`Created: ${new Date(latest.createdAt).toISOString()}`);
        }
        if (state !== "READY") failures++;
      }
    }
  } catch (error) {
    failures++;
    console.log(`\n✗ Vercel API unreachable (${error.message})`);
  }
} else {
  const missing = [
    !token && "VERCEL_TOKEN",
    !projectId && "VERCEL_PROJECT_ID",
  ].filter(Boolean);
  console.log(
    `\n⚠️  Vercel API check skipped — set ${missing.join(" and ")}. ` +
      "HTTP checks still ran.",
  );
}

console.log(`\n${failures === 0 ? "✅ Live site healthy." : `❌ ${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
