#!/usr/bin/env node
/**
 * E2E proof for the QR-code (authenticator) signup/login fallback.
 *
 * Usage: node scripts/qr-fallback-e2e.mjs [baseUrl]
 * Defaults to http://localhost:3000 (the dev server). Reads Supabase env from
 * .env.local. Creates a throwaway user via the real API routes, verifies the
 * session, and deletes the user afterwards. No email is ever sent.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.argv[2] || "http://localhost:3000";
const env = {};
for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  process.exit(1);
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32decode(s) {
  const clean = s.toUpperCase().replace(/[=\s]/g, "");
  const bytes = [];
  let bits = 0, value = 0;
  for (const c of clean) {
    const idx = BASE32.indexOf(c);
    if (idx < 0) throw new Error(`bad base32 char ${c}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(bytes);
}
function totp(secret, step = 30, digits = 6, timeMs = Date.now()) {
  const counter = Math.floor(timeMs / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", b32decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return (bin % 10 ** digits).toString().padStart(digits, "0");
}

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

const email = `qr-fallback-${Date.now()}@test.adswish.local`;

async function post(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const service = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

try {
  // 1. Start the QR signup
  const started = await post("/api/internal/auth/qr-signup", {
    action: "start", email, role: "creator",
  });
  check("qr-signup start returns secret + QR", started.status === 200 && !!started.json.secret && String(started.json.qr_data).startsWith("data:image"), `status ${started.status}`);
  const secret = started.json.secret;
  if (!secret) process.exit(1);

  // 2. Wrong code is rejected
  const wrong = await post("/api/internal/auth/qr-signup", {
    action: "complete", email, code: "000000",
  });
  check("wrong code rejected", wrong.status === 400, `status ${wrong.status}`);

  // 3. Correct code creates the account + issues a session
  const code = totp(secret);
  const done = await post("/api/internal/auth/qr-signup", {
    action: "complete", email, code,
  });
  check(
    "qr-signup complete issues a session",
    done.status === 200 && !!done.json.access_token && !!done.json.refresh_token,
    `status ${done.status}`,
  );

  const anon = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await anon.auth.setSession({ access_token: done.json.access_token, refresh_token: done.json.refresh_token });
  const { data: user1 } = await anon.auth.getUser();
  check("session belongs to the new user", user1?.user?.email === email, user1?.user?.email || "no user");

  // 4. Login again with a fresh code (authenticator path)
  const freshCode = totp(secret);
  const again = await post("/api/internal/auth/totp-login", { email, code: freshCode });
  check("totp-login issues a fresh session", again.status === 200 && !!again.json.access_token, `status ${again.status}`);
  const anon2 = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await anon2.auth.setSession({ access_token: again.json.access_token, refresh_token: again.json.refresh_token });
  const { data: user2 } = await anon2.auth.getUser();
  check("second session works", user2?.user?.email === email, user2?.user?.email || "no user");

  // 5. Bad code on login is rejected
  const badLogin = await post("/api/internal/auth/totp-login", { email, code: "000000" });
  check("totp-login rejects wrong code", badLogin.status === 400, `status ${badLogin.status}`);

  // 6. totp_pending was cleaned up
  const { data: pendingRows } = await service.from("totp_pending").select("email").eq("email", email);
  check("pending row cleaned up", !pendingRows || pendingRows.length === 0, `${pendingRows?.length ?? 0} rows`);

  console.log(failures === 0 ? "\nALL GREEN 🎉" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
} finally {
  // Cleanup: delete the throwaway user + any leftover rows.
  const { data: found } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const target = (found?.users ?? []).find((u) => u.email === email);
  if (target) {
    await service.auth.admin.deleteUser(target.id);
    await service.from("totp_credentials").delete().eq("user_id", target.id);
    await service.from("creator_profiles").delete().eq("user_id", target.id);
    await service.from("notification_preferences").delete().eq("user_id", target.id);
    console.log("🧹 Throwaway user deleted");
  } else {
    console.log("🧹 No user to delete (already clean)");
  }
  await service.from("totp_pending").delete().eq("email", email);
}
