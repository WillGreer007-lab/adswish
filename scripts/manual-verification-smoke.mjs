#!/usr/bin/env node
/**
 * Manual follower-verification smoke test (local dev server + cloud Supabase).
 *
 * Proves the zero-OAuth path works end to end:
 *   creator uploads a follower-count screenshot (pending)
 *     → admin approves it
 *     → creator's social account + tier refresh, notification sent.
 *
 * Uses throwaway creator + admin (no 2FA) so the middleware MFA gate doesn't
 * interfere. Cleans up all fixtures + the uploaded screenshot afterwards.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const L = {};
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) L[m[1]] = m[2].trim();
}
const SUPABASE_URL = L.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = L.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = L.SUPABASE_SERVICE_ROLE_KEY;
const BASE = "http://localhost:3000";
const REF = SUPABASE_URL.match(/https:\/\/([^.]+)\./)[1];

const cookieFor = (session) =>
  `base64-${Buffer.from(JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  })).toString("base64url")}`;

let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

// 1x1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const service = createClient(SUPABASE_URL, SERVICE_KEY);
const anon = createClient(SUPABASE_URL, ANON_KEY);
const suffix = Date.now();
const creatorEmail = `verify-creator-${suffix}@adswish.test`;
const adminEmail = `verify-admin-${suffix}@adswish.test`;
const PASSWORD = "VerifySmoke123!";
let creatorId = null;
let adminId = null;
let storagePath = null;

try {
  // Throwaway creator + profile.
  const { data: creator } = await service.auth.admin.createUser({
    email: creatorEmail,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: "creator" },
  });
  creatorId = creator.user.id;
  await service.from("creator_profiles").upsert({
    user_id: creatorId,
    display_name: "Verify Smoke",
    account_status: "active",
    onboarding_step: "complete",
    tier: "micro",
  });

  // Throwaway admin (role in app_metadata, no 2FA).
  const { data: admin } = await service.auth.admin.createUser({
    email: adminEmail,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { role: "admin" },
  });
  adminId = admin.user.id;

  const creatorSess = await anon.auth.signInWithPassword({ email: creatorEmail, password: PASSWORD });
  const adminSess = await anon.auth.signInWithPassword({ email: adminEmail, password: PASSWORD });
  if (!creatorSess.data.session || !adminSess.data.session) throw new Error("sign-in failed");
  const creatorCookie = cookieFor(creatorSess.data.session);
  const adminCookie = cookieFor(adminSess.data.session);

  // 1. Creator submits a screenshot for manual verification (platform=tiktok).
  const form = new FormData();
  form.append("platform", "tiktok");
  form.append("handle", "smokecreator");
  form.append("follower_count", "1500000");
  form.append("file", new Blob([PNG], { type: "image/png" }), "screenshot.png");
  const submitRes = await fetch(`${BASE}/api/internal/manual-verifications`, {
    method: "POST",
    redirect: "manual",
    body: form,
    headers: { cookie: `sb-${REF}-auth-token=${creatorCookie}` },
  });
  const submit = await submitRes.json().catch(() => ({}));
  check("creator submits screenshot", submitRes.status === 201, `status ${submitRes.status}`);
  const verificationId = submit?.verification?.id;
  check("submission is pending", submit?.verification?.status === "pending");
  storagePath = submit?.verification?.storage_path ?? null;

  // 2. Admin approves it.
  const approveRes = await fetch(`${BASE}/api/internal/admin/manual-verifications`, {
    method: "PATCH",
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      cookie: `sb-${REF}-auth-token=${adminCookie}`,
    },
    body: JSON.stringify({ id: verificationId, status: "approved" }),
  });
  const approve = await approveRes.json().catch(() => ({}));
  check("admin approves screenshot", approveRes.status === 200 && approve.ok === true, `status ${approveRes.status} ${JSON.stringify(approve).slice(0, 120)}`);

  // 3. Verify the observable outcomes.
  const { data: social } = await service
    .from("creator_social_accounts")
    .select("follower_count, verified_at, platform")
    .eq("creator_id", creatorId)
    .eq("platform", "tiktok")
    .maybeSingle();
  check("social account created + verified", Boolean(social?.verified_at), JSON.stringify(social));
  check("follower count recorded (1.5M)", Number(social?.follower_count) === 1500000, String(social?.follower_count));

  const { data: profile } = await service
    .from("creator_profiles")
    .select("tier, previous_tier")
    .eq("user_id", creatorId)
    .single();
  check("tier recomputed to macro", profile?.tier === "macro", `tier=${profile?.tier} previous=${profile?.previous_tier}`);

  const { data: notif } = await service
    .from("notifications")
    .select("body")
    .eq("user_id", creatorId)
    .eq("type", "system")
    .maybeSingle();
  check("creator notified of approval", Boolean(notif), notif?.body);

  console.log(`\n${pass} passed, ${fail} failed`);
} catch (e) {
  console.error("❌ Fatal:", e.message);
  fail++;
} finally {
  try {
    if (creatorId) {
      await service.from("creator_social_accounts").delete().eq("creator_id", creatorId);
      await service.from("manual_follower_verifications").delete().eq("creator_id", creatorId);
      await service.from("notifications").delete().eq("user_id", creatorId);
      await service.from("creator_profiles").delete().eq("user_id", creatorId);
      await service.auth.admin.deleteUser(creatorId);
    }
  } catch {}
  try {
    if (adminId) await service.auth.admin.deleteUser(adminId);
  } catch {}
  try {
    if (storagePath) await service.storage.from("creator-verification").remove([storagePath]);
  } catch {}
  console.log("Cleanup complete.");
}

process.exit(fail ? 1 : 0);
