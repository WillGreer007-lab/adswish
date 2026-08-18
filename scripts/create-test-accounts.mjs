#!/usr/bin/env node
// Create the two Adswish test accounts in cloud Supabase:
//   - business: willgreer38@gmail.com / 123456
//   - creator:  wgreer301@gmail.com    / 123456
//
// Uses the public signup endpoint (the same path the app UI uses) because the
// Auth admin "create user" endpoint fails on the auth.users trigger, then
// confirms the email via the admin API and upserts the profile rows.
//
// Safe to re-run: existing users are left alone and profiles are upserted.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function loadEnv() {
  const raw = readFileSync(resolve(projectRoot, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return env;
}

const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SR = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SR) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

async function getOrCreateUser(email, password, role) {
  // 1) Try the public signup path first (works with the auth.users trigger).
  const su = await fetch(`${URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, data: { role } }),
  });
  const suBody = await su.json().catch(() => ({}));

  let userId = suBody.user?.id || suBody.id;
  if (su.ok && userId) {
    console.log(`  created via signup (id ${userId})`);
  } else {
    // Already registered — look up the existing id.
    const msg = suBody.msg || "";
    console.log(`  ${msg ? `signup said: ${msg}` : "signup failed"}; looking up existing user`);
    const listRes = await fetch(`${URL}/auth/v1/admin/users?page=1&per_page=200`, {
      headers: { apikey: SR, Authorization: `Bearer ${SR}` },
    });
    const list = await listRes.json();
    userId = (list.users || []).find((u) => u.email === email)?.id ?? null;
  }

  if (!userId) return null;

  // 2) Confirm the email + ensure the role metadata is set.
  const cf = await fetch(`${URL}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email_confirm: true, user_metadata: { role } }),
  });
  if (!cf.ok) console.error(`  ! failed to confirm ${email} (${cf.status})`);
  return userId;
}

async function upsert(table, row) {
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SR,
      Authorization: `Bearer ${SR}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(row),
  });
  return res.ok;
}

const accounts = [
  {
    email: "willgreer38@gmail.com",
    password: "123456",
    role: "business",
    table: "business_profiles",
    profile: { company_name: "GreerCo", account_status: "active", onboarding_step: "complete" },
  },
  {
    email: "wgreer301@gmail.com",
    password: "123456",
    role: "creator",
    table: "creator_profiles",
    profile: { display_name: "Will Greer", account_status: "active", tier: "micro", onboarding_step: "complete" },
  },
];

for (const acc of accounts) {
  console.log(`\n== ${acc.email} (${acc.role}) ==`);
  const userId = await getOrCreateUser(acc.email, acc.password, acc.role);
  if (!userId) {
    console.error("  ! could not resolve user id — skipping profile");
    continue;
  }
  const profileOk = await upsert(acc.table, { user_id: userId, ...acc.profile });
  const prefsOk = await upsert("notification_preferences", { user_id: userId });
  console.log(`  profile: ${profileOk ? "OK" : "FAILED"} · prefs: ${prefsOk ? "OK" : "FAILED"}`);
}

console.log("\nDone.");
