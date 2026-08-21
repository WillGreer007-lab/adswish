#!/usr/bin/env node
/**
 * Team seat lifecycle E2E (against the local dev server + cloud Supabase).
 * Uses throwaway accounts (no 2FA) so the middleware MFA gate doesn't redirect:
 *   owner (fresh business) → invite a throwaway user by email
 *   invitee → sees pending invite → accepts (joined_at set)
 *   owner → revokes (member removed, app_metadata cleared)
 * Cleans up all fixtures afterwards.
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

const api = async (path, opts, cookie) => {
  const res = await fetch(BASE + path, {
    ...opts,
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie: `sb-${REF}-auth-token=${cookie}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const service = createClient(SUPABASE_URL, SERVICE_KEY);
const anon = createClient(SUPABASE_URL, ANON_KEY);
const suffix = Date.now();
const ownerEmail = `team-owner-${suffix}@adswish.test`;
const inviteeEmail = `team-member-${suffix}@adswish.test`;
const PASSWORD = "TeamE2E123!";
let ownerId = null;
let inviteeId = null;

try {
  // 1. Create a throwaway business owner + profile (no 2FA).
  const { data: ownerUser, error: ownerErr } = await service.auth.admin.createUser({
    email: ownerEmail,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: "business" },
  });
  if (ownerErr) throw new Error("create owner: " + ownerErr.message);
  ownerId = ownerUser.user.id;
  await service.from("business_profiles").upsert({
    user_id: ownerId,
    company_name: "Team E2E Co",
    account_status: "active",
    onboarding_step: "complete",
  });
  await service.from("business_subscriptions").upsert(
    { business_id: ownerId, plan_slug: "business_growth", status: "active", team_seats_used: 1 },
    { onConflict: "business_id" },
  );

  const owner = await anon.auth.signInWithPassword({ email: ownerEmail, password: PASSWORD });
  if (!owner.data.session) throw new Error("owner sign-in failed");
  const ownerCookie = cookieFor(owner.data.session);
  console.log(`Owner ready: ${ownerEmail}`);

  // 2. Owner invites the throwaway invitee.
  const invite = await api("/api/internal/team", {
    method: "POST",
    body: JSON.stringify({ email: inviteeEmail, role: "member" }),
  }, ownerCookie);
  check("owner invites teammate by email", invite.status === 201, `status ${invite.status} ${JSON.stringify(invite.body).slice(0, 120)}`);

  // 3. Invitee exists + tagged.
  const { data: created } = await service.auth.admin.listUsers();
  const createdUser = (created?.users ?? []).find((u) => u.email === inviteeEmail);
  check("invitee auth user created", Boolean(createdUser));
  check("invitee tagged with business_id", createdUser?.app_metadata?.business_id === ownerId);
  inviteeId = createdUser?.id ?? null;

  // 4. Pending membership row (joined_at null).
  const { data: pendingRow } = await service
    .from("business_team_members")
    .select("joined_at")
    .eq("business_id", ownerId)
    .eq("user_id", inviteeId)
    .maybeSingle();
  check("membership row pending (joined_at null)", pendingRow && pendingRow.joined_at === null);

  // 5. Invitee is unconfirmed + passwordless. Generate the same password-set
  //    (invite) link the email would contain, confirm it exists, then simulate
  //    the invitee setting a password + confirming via the admin API, and sign in.
  const { data: link } = await service.auth.admin.generateLink({
    type: "invite",
    email: inviteeEmail,
    options: { redirectTo: "http://localhost:3000/dashboard/business/profile" },
  });
  const actionLink = link?.properties?.action_link;
  check("password-set invite link generated", Boolean(actionLink));

  await service.auth.admin.updateUserById(inviteeId, { password: PASSWORD, email_confirm: true });
  const invitee = await anon.auth.signInWithPassword({ email: inviteeEmail, password: PASSWORD });
  check("invitee signs in", Boolean(invitee.data?.session), invitee.error?.message);
  if (invitee.data?.session) {
    const inviteeCookie = cookieFor(invitee.data.session);
    const accept = await api("/api/internal/team", {
      method: "PATCH",
      body: JSON.stringify({ action: "accept" }),
    }, inviteeCookie);
    check("invitee accepts invite", accept.status === 200 && accept.body.accepted === true, `status ${accept.status}`);

    const { data: joinedRow } = await service
      .from("business_team_members")
      .select("joined_at")
      .eq("business_id", ownerId)
      .eq("user_id", inviteeId)
      .maybeSingle();
    check("membership joined_at set", Boolean(joinedRow?.joined_at));
  }

  // 6. Owner revokes.
  const revoke = await api("/api/internal/team", {
    method: "DELETE",
    body: JSON.stringify({ user_id: inviteeId }),
  }, ownerCookie);
  check("owner revokes member", revoke.status === 200 && revoke.body.revoked === true, `status ${revoke.status}`);

  const { data: gone } = await service
    .from("business_team_members")
    .select("user_id")
    .eq("business_id", ownerId)
    .eq("user_id", inviteeId)
    .maybeSingle();
  check("membership row removed after revoke", !gone);

  console.log(`\n${pass} passed, ${fail} failed`);
} catch (e) {
  console.error("❌ Fatal:", e.message);
  fail++;
} finally {
  try {
    if (inviteeId) await service.auth.admin.deleteUser(inviteeId);
  } catch {}
  try {
    if (ownerId) {
      await service.from("business_subscriptions").delete().eq("business_id", ownerId);
      await service.from("business_profiles").delete().eq("user_id", ownerId);
      await service.auth.admin.deleteUser(ownerId);
    }
  } catch {}
  console.log("Cleanup complete.");
}

process.exit(fail ? 1 : 0);
