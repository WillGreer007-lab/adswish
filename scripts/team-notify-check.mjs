#!/usr/bin/env node
// Verify: owner receives an in-app notification when a teammate accepts.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const L = {};
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) L[m[1]] = m[2].trim();
}
const SUPABASE_URL = L.NEXT_PUBLIC_SUPABASE_URL;
const ANON = L.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = L.SUPABASE_SERVICE_ROLE_KEY;
const REF = SUPABASE_URL.match(/https:\/\/([^.]+)\./)[1];
const BASE = "http://localhost:3000";

const service = createClient(SUPABASE_URL, SERVICE);
const anon = createClient(SUPABASE_URL, ANON);
const suffix = Date.now();
const ownerEmail = `notify-owner-${suffix}@adswish.test`;
const memberEmail = `notify-member-${suffix}@adswish.test`;
const PW = "Notify123!";
let ownerId, memberId;

const cookieFor = (s) =>
  `base64-${Buffer.from(JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at })).toString("base64url")}`;
const api = async (path, opts, cookie) => {
  const r = await fetch(BASE + path, { ...opts, redirect: "manual", headers: { "content-type": "application/json", ...(cookie ? { cookie: `sb-${REF}-auth-token=${cookie}` } : {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

let pass = 0, fail = 0;
const check = (n, ok, d) => { console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); ok ? pass++ : fail++; };

try {
  const { data: owner } = await service.auth.admin.createUser({ email: ownerEmail, password: PW, email_confirm: true, user_metadata: { role: "business" } });
  ownerId = owner.user.id;
  await service.from("business_profiles").upsert({ user_id: ownerId, company_name: "Notify Co", account_status: "active", onboarding_step: "complete" });
  await service.from("business_subscriptions").upsert({ business_id: ownerId, plan_slug: "business_growth", status: "active", team_seats_used: 1 }, { onConflict: "business_id" });

  const ownerSess = await anon.auth.signInWithPassword({ email: ownerEmail, password: PW });
  const ownerCookie = cookieFor(ownerSess.data.session);

  const invite = await api("/api/internal/team", { method: "POST", body: JSON.stringify({ email: memberEmail, role: "member" }) }, ownerCookie);
  check("invite sent", invite.status === 201);

  const { data: users } = await service.auth.admin.listUsers();
  memberId = (users.users ?? []).find((u) => u.email === memberEmail)?.id;

  await service.auth.admin.updateUserById(memberId, { password: PW, email_confirm: true });
  const memberSess = await anon.auth.signInWithPassword({ email: memberEmail, password: PW });
  const memberCookie = cookieFor(memberSess.data.session);
  const accept = await api("/api/internal/team", { method: "PATCH", body: JSON.stringify({ action: "accept" }) }, memberCookie);
  check("member accepts", accept.status === 200 && accept.body.accepted === true);

  const { data: notifs } = await service.from("notifications").select("body, type, link").eq("user_id", ownerId).order("created_at", { ascending: false }).limit(5);
  const hasNotif = (notifs ?? []).some((n) => n.type === "system" && /accepted your team invitation/.test(n.body));
  check("owner received accept notification", hasNotif, notifs?.[0]?.body ?? "none");

  console.log(`\n${pass} passed, ${fail} failed`);
} catch (e) {
  console.error("❌ Fatal:", e.message);
  fail++;
} finally {
  try {
    if (memberId) await service.auth.admin.deleteUser(memberId);
    if (ownerId) {
      await service.from("business_subscriptions").delete().eq("business_id", ownerId);
      await service.from("business_profiles").delete().eq("user_id", ownerId);
      await service.auth.admin.deleteUser(ownerId);
    }
  } catch {}
  console.log("Cleanup complete.");
}
process.exit(fail ? 1 : 0);
