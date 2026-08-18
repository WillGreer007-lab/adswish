#!/usr/bin/env node
/**
 * Admin + MFA end-to-end on production:
 * 1. Sign in as the admin account (willgreer38@gmail.com / 123456).
 * 2. Enroll a TOTP factor, generate a real RFC-6238 code from the secret,
 *    challenge + verify to upgrade the session to AAL2.
 * 3. Fetch every /admin page with the AAL2 session cookie → expect 200.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const SUPABASE_URL = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim();
const ANON_KEY = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)[1].trim();
const BASE = "https://adswish-lake.vercel.app";
const REF = SUPABASE_URL.match(/https:\/\/([^.]+)\./)[1];

// RFC 6238 TOTP (SHA1, 30s step, 6 digits) — mirrors what authenticator apps do
function totp(secretB32, timeStep = 30, digits = 6) {
  const b32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secretB32.replace(/=+$/, "").toUpperCase()) {
    bits += b32.indexOf(c).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{1,8}/g).map((b) => parseInt(b, 2)));
  const counter = Math.floor(Date.now() / 1000 / timeStep);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return (bin % 10 ** digits).toString().padStart(digits, "0");
}

function cookieFor(session) {
  const payload = { access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at };
  return `base64-${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const ADMIN_PAGES = ["/admin", "/admin/audit-logs", "/admin/fraud", "/admin/sla", "/admin/telemetry", "/admin/users"];

try {
  const sb = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: signin, error: signinErr } = await sb.auth.signInWithPassword({ email: "willgreer38@gmail.com", password: "123456" });
  if (signinErr) throw new Error("signin: " + signinErr.message);
  check("Admin sign-in", true, signin.user.email);

  // 1. Enroll TOTP
  const { data: enroll, error: enrollErr } = await sb.auth.mfa.enroll({ factorType: "totp", issuer: "Adswish", friendlyName: "Admin Authenticator" });
  if (enrollErr) throw new Error("enroll: " + enrollErr.message);
  check("TOTP factor enrolled", true, `factor ${enroll.id.slice(0, 8)}…`);
  const secret = enroll.totp.secret;

  // 2. Challenge + verify with a real code
  const { data: challenge, error: chalErr } = await sb.auth.mfa.challenge({ factorId: enroll.id });
  if (chalErr) throw new Error("challenge: " + chalErr.message);
  const code = totp(secret);
  const { data: verify, error: verifyErr } = await sb.auth.mfa.verify({ factorId: enroll.id, challengeId: challenge.id, code });
  if (verifyErr) throw new Error("verify: " + verifyErr.message);
  check("MFA verify with RFC-6238 code", true, `code ${code} accepted`);

  // 3. Check AAL level
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  check("Session upgraded to AAL2", aal?.currentLevel === "aal2", `level ${aal?.currentLevel}`);

  // 4. Sweep admin pages with the session
  const cookie = cookieFor(verify);
  for (const p of ADMIN_PAGES) {
    const res = await fetch(BASE + p, { headers: { cookie: `sb-${REF}-auth-token=${cookie}` }, redirect: "manual" });
    const loc = res.headers.get("location") ?? "";
    const ok = res.status === 200;
    check(`${res.status} ${p}`, ok, ok ? "" : `→ ${loc}`);
  }

  console.log(`\nTOTP secret (save for your authenticator app): ${secret}`);
  console.log(`otpauth://totp/Adswish:willgreer38@gmail.com?secret=${secret}&issuer=Adswish&digits=6&period=30`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}
