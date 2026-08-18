#!/usr/bin/env node
/**
 * Multi-role regression sweep against the production site.
 * Signs in as business + creator via Supabase password auth, builds the exact
 * cookie shape @supabase/ssr expects (base64-<base64url-json>), then fetches
 * every dashboard page for each role and reports HTTP status.
 * Also verifies the /admin gates (unauth -> /login, non-admin -> /dashboard).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const SUPABASE_URL = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim();
const ANON_KEY = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)[1].trim();
const BASE = "https://adswish-lake.vercel.app";

function cookieFor(session) {
  const payload = { access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at };
  return `base64-${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

async function login(email, password) {
  const sb = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email}: ${error.message}`);
  return data.session;
}

async function sweep(name, session, paths) {
  const cookie = cookieFor(session);
  console.log(`\n=== ${name} ===`);
  let pass = 0, fail = 0, seen = new Set();
  for (const p of paths) {
    if (seen.has(p)) continue;
    seen.add(p);
    const res = await fetch(BASE + p, { headers: { cookie: `sb-${extractRef(SUPABASE_URL)}-auth-token=${cookie}` }, redirect: "manual" });
    const loc = res.headers.get("location") ?? "";
    // /dashboard redirecting to the role-scoped home is expected routing
    const roleHome = name === "BUSINESS" ? "/dashboard/business" : "/dashboard/creator";
    const ok = res.status === 200 || (res.status === 307 && p === "/dashboard" && loc.includes(roleHome));
    console.log(`${ok ? "✅" : "❌"} ${res.status} ${p}${res.status === 307 || res.status === 302 ? " → " + loc : ""}`);
    ok ? pass++ : fail++;
  }
  console.log(`${name}: ${pass} ok, ${fail} not-200`);
  return { pass, fail };
}

function extractRef(url) {
  // Supabase project ref is the subdomain of the URL
  return url.match(/https:\/\/([^.]+)\./)[1];
}

const businessPaths = [
  "/dashboard", "/dashboard/business", "/dashboard/business/campaigns",
  "/dashboard/business/campaigns/new", "/dashboard/business/applicants",
  "/dashboard/business/payments", "/dashboard/business/messages",
  "/dashboard/business/profile", "/dashboard/business/tracking",
  "/dashboard/settings", "/dashboard/settings/notifications",
];

const creatorPaths = [
  "/dashboard", "/dashboard/creator", "/dashboard/creator/campaigns",
  "/dashboard/creator/discover", "/dashboard/creator/earnings",
  "/dashboard/creator/payouts", "/dashboard/creator/profile",
  "/dashboard/creator/messages", "/dashboard/settings", "/dashboard/settings/notifications",
];

const adminPaths = ["/admin", "/admin/audit-logs", "/admin/fraud", "/admin/sla", "/admin/telemetry", "/admin/users"];

const totals = { pass: 0, fail: 0 };

try {
  const business = await login("willgreer38@gmail.com", "123456");
  const r1 = await sweep("BUSINESS", business, businessPaths);
  totals.pass += r1.pass; totals.fail += r1.fail;

  const creator = await login("wgreer301@gmail.com", "123456");
  const r2 = await sweep("CREATOR", creator, creatorPaths);
  totals.pass += r2.pass; totals.fail += r2.fail;

  // Admin gates: no admin account exists, so pages must redirect (never 500).
  console.log("\n=== ADMIN GATES (no admin account exists) ===");
  for (const p of adminPaths) {
    // 1. unauthenticated
    const unauth = await fetch(BASE + p, { redirect: "manual" });
    console.log(`${unauth.status === 307 && (unauth.headers.get("location") ?? "").includes("/login") ? "✅" : "❌"} ${unauth.status} ${p} unauth → ${unauth.headers.get("location") ?? "no-redirect"}`);
    unauth.status === 307 && (unauth.headers.get("location") ?? "").includes("/login") ? totals.pass++ : totals.fail++;
    // 2. as business (non-admin)
    const asBiz = await fetch(BASE + p, { headers: { cookie: `sb-${extractRef(SUPABASE_URL)}-auth-token=${cookieFor(business)}` }, redirect: "manual" });
    const loc = asBiz.headers.get("location") ?? "";
    console.log(`${asBiz.status === 307 && (loc.includes("/dashboard") || loc.includes("/admin/mfa")) ? "✅" : "❌"} ${asBiz.status} ${p} as-business → ${loc}`);
    asBiz.status === 307 && (loc.includes("/dashboard") || loc.includes("/admin/mfa")) ? totals.pass++ : totals.fail++;
  }

  console.log(`\nTOTAL: ${totals.pass} ok, ${totals.fail} failed`);
  process.exit(totals.fail === 0 ? 0 : 1);
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}
