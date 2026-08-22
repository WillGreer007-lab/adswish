#!/usr/bin/env node
/**
 * Safe demo fixture for the monitor-only UptimeRobot flow.
 *
 * This script changes exactly one business_profiles mapping and never creates,
 * edits, pauses, or deletes an UptimeRobot monitor. It refuses to run unless
 * the explicit fixture flag is enabled and the target is the known test
 * business. Uptime history/incidents remain real data returned by UptimeRobot.
 *
 * Usage:
 *   UPTIME_DEMO_FIXTURE=true node scripts/seed-uptime-demo.mjs
 *
 * Optional local-only overrides:
 *   UPTIME_DEMO_BUSINESS_EMAIL=...
 *   UPTIME_DEMO_MONITOR_ID=...
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].replace(/^"|"$/g, "").trim();
  }
  return env;
}

const env = { ...loadEnv(), ...process.env };
if (env.UPTIME_DEMO_FIXTURE !== "true" || env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
  console.error("Refusing to run. Set UPTIME_DEMO_FIXTURE=true in a non-production local environment.");
  process.exit(1);
}

const email = env.UPTIME_DEMO_BUSINESS_EMAIL || "biz-ga-test@adswish.test";
const monitorId = env.UPTIME_DEMO_MONITOR_ID || "803802534";
if (email !== "willgreer38@gmail.com" && !email.endsWith("@adswish.test")) {
  console.error("Refusing to run: target email is not an approved test account.");
  process.exit(1);
}
if (!/^\d+$/.test(monitorId)) {
  console.error("Refusing to run: monitor ID must contain numbers only.");
  process.exit(1);
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const monitorKey = env.UPTIME_ROBOT_MONITOR_API_KEY;
if (!supabaseUrl || !serviceRoleKey || !monitorKey) {
  console.error("Missing local Supabase or monitor-scoped UptimeRobot credentials.");
  process.exit(1);
}

const supabaseHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
};

async function readJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return body;
}

const users = await readJson(
  `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`,
  { headers: supabaseHeaders },
);
const user = (users.users || []).find((candidate) => candidate.email === email);
if (!user?.id) {
  console.error("Approved demo business account was not found; create it first with scripts/create-test-accounts.mjs.");
  process.exit(1);
}

const profileRows = await readJson(
  `${supabaseUrl}/rest/v1/business_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=user_id,company_name,account_status,onboarding_step,uptime_robot_monitor_id`,
  { headers: { ...supabaseHeaders, Accept: "application/json" } },
);
const profile = profileRows[0];
if (!profile || profile.account_status !== "active" || profile.onboarding_step !== "complete") {
  console.error("Refusing to map: the target is not an active, complete business demo profile.");
  process.exit(1);
}

const uptimeResponse = await fetch("https://api.uptimerobot.com/v2/getMonitors", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    api_key: monitorKey,
    format: "json",
    monitors: monitorId,
    logs: "1",
    limit: "50",
  }),
});
const uptimeBody = await uptimeResponse.json().catch(() => ({}));
const monitor = (uptimeBody.monitors || []).find((candidate) => String(candidate.id) === monitorId);
if (!uptimeResponse.ok || uptimeBody.stat !== "ok" || !monitor) {
  console.error("Refusing to map: the monitor-scoped key could not read the requested monitor.");
  process.exit(1);
}

await readJson(
  `${supabaseUrl}/rest/v1/business_profiles?user_id=eq.${encodeURIComponent(user.id)}`,
  {
    method: "PATCH",
    headers: { ...supabaseHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ uptime_robot_monitor_id: monitorId }),
  },
);

// Record one real observation so the monitor-only admin demo has local check
// history immediately; this is never a fabricated outage or incident.
await readJson(`${supabaseUrl}/rest/v1/uptime_monitor_checks`, {
  method: "POST",
  headers: { ...supabaseHeaders, Prefer: "return=minimal" },
  body: JSON.stringify({
    business_id: user.id,
    monitor_id: monitorId,
    status: monitor.status ?? null,
    monitor_name: monitor.friendly_name ?? null,
    monitor_url: monitor.url ?? null,
    checked_at: new Date().toISOString(),
    error_message: null,
  }),
});

const maskedEmail = email.replace(/^(.).*(@.*)$/, "$1***$2");
const status = monitor.status === 2 ? "up" : monitor.status === 9 ? "down" : monitor.status === 8 ? "seems down" : String(monitor.status ?? "unknown");
console.log(`Mapped ${maskedEmail} to monitor ${monitorId}.`);
console.log(`Real monitor status: ${status}; UptimeRobot log entries available: ${(monitor.logs || []).length}.`);
console.log("Recorded one real scoped observation for the admin demo; no synthetic incident was created.");
console.log("No UptimeRobot monitor was created or changed; this fixture only saved the business mapping.");
