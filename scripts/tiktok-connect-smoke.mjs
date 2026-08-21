#!/usr/bin/env node
/**
 * TikTok Connect smoke test (local dev server + cloud Supabase).
 *
 * The actual TikTok authorization page requires a human to log in, so this
 * verifies everything automatable up to that point:
 *   1. TIKTOK_CLIENT_KEY/SECRET are set (the connect gate is open).
 *   2. A signed-in creator hitting the start route is redirected to TikTok's
 *      authorize URL with the right client_key, scope, and callback redirect.
 *   3. The callback route handles a denied/error response gracefully.
 *
 * The follower-count → tier refresh path is covered by the hermetic test at
 * src/lib/follower-recheck.integration.test.ts (real code, stubbed API).
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

const service = createClient(SUPABASE_URL, SERVICE_KEY);
const anon = createClient(SUPABASE_URL, ANON_KEY);
const suffix = Date.now();
const creatorEmail = `tiktok-smoke-${suffix}@adswish.test`;
const PASSWORD = "TikTokSmoke123!";
let creatorId = null;

try {
  check("TIKTOK_CLIENT_KEY set", Boolean(L.TIKTOK_CLIENT_KEY));
  check("TIKTOK_CLIENT_SECRET set", Boolean(L.TIKTOK_CLIENT_SECRET));

  // Throwaway creator (no 2FA) so the middleware MFA gate doesn't redirect.
  const { data: user, error: createErr } = await service.auth.admin.createUser({
    email: creatorEmail,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: "creator" },
  });
  if (createErr) throw new Error("create creator: " + createErr.message);
  creatorId = user.user.id;
  await service.from("creator_profiles").upsert({
    user_id: creatorId,
    display_name: "TikTok Smoke",
    account_status: "active",
    onboarding_step: "complete",
  });

  const sess = await anon.auth.signInWithPassword({ email: creatorEmail, password: PASSWORD });
  if (!sess.data.session) throw new Error("creator sign-in failed");
  const cookie = cookieFor(sess.data.session);

  // Start route → should 307 to TikTok authorize (not tiktok_not_configured).
  const res = await fetch(
    `${BASE}/api/internal/oauth/tiktok?redirect_to=/onboarding/creator/connect_social`,
    { redirect: "manual", headers: { cookie: `sb-${REF}-auth-token=${cookie}` } },
  );
  const location = res.headers.get("location") || "";
  check("start route redirects (307)", res.status === 307, `status ${res.status}`);
  check("redirects to TikTok authorize", location.includes("tiktok.com/v2/auth/authorize"), location);
  check("authorize includes client_key", location.includes(`client_key=${L.TIKTOK_CLIENT_KEY}`));
  check("authorize requests user.info.basic", location.includes("scope=user.info.basic"));
  check(
    "authorize uses the local callback URI",
    location.includes(encodeURIComponent(`${BASE}/api/internal/oauth/tiktok/callback`)),
  );

  // Callback error path → graceful redirect back to connect_social.
  const cb = await fetch(`${BASE}/api/internal/oauth/tiktok/callback?error=access_denied`, {
    redirect: "manual",
  });
  const cbLocation = cb.headers.get("location") || "";
  check("callback handles denial gracefully", cb.status === 307 && cbLocation.includes("connect_social?error=access_denied"), cbLocation);

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("\nRegister these redirect URIs in the TikTok developer dashboard (Login Kit → Callback URL / Redirect domain):");
  console.log(`  ${BASE}/api/internal/oauth/tiktok/callback`);
} catch (e) {
  console.error("❌ Fatal:", e.message);
  fail++;
} finally {
  try {
    if (creatorId) {
      await service.from("creator_social_accounts").delete().eq("creator_id", creatorId);
      await service.from("creator_profiles").delete().eq("user_id", creatorId);
      await service.auth.admin.deleteUser(creatorId);
    }
  } catch {}
  console.log("Cleanup complete.");
}

process.exit(fail ? 1 : 0);
