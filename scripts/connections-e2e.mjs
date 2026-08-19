#!/usr/bin/env node
/**
 * Connections + campaign-invite E2E (against the local dev server, which uses
 * cloud Supabase):
 *   business → friend request → creator accepts → both see friend
 *   business → campaign invite → creator accepts → application auto-created
 * Cleans up all fixtures afterwards.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const SUPABASE_URL = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim();
const ANON_KEY = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)[1].trim();
const SERVICE_KEY = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim();
const BASE = "http://localhost:3000";
const REF = SUPABASE_URL.match(/https:\/\/([^.]+)\./)[1];

const cookieFor = (session) =>
  `base64-${Buffer.from(JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  })).toString("base64url")}`;

async function login(email, password) {
  const sb = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email}: ${error.message}`);
  return data.session;
}

const api = async (path, opts, cookie) => {
  const res = await fetch(BASE + path, {
    ...opts,
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
const ids = { campaign: null, connection: null, invite: null, application: null };

try {
  const business = await login("willgreer38@gmail.com", "123456");
  const creator = await login("wgreer301@gmail.com", "123456");
  const bizCookie = cookieFor(business);
  const creCookie = cookieFor(creator);
  const bizId = business.user.id;
  const creId = creator.user.id;

  // 1. Business sends a friend request to the creator.
  const send = await api("/api/internal/connections", {
    method: "POST",
    body: JSON.stringify({ addressee_id: creId }),
  }, bizCookie);
  check("business → friend request", send.status === 201 || (send.status === 200 && send.body.exists), `status ${send.status}`);
  ids.connection = send.body.connection?.id;

  // 2. Creator sees the incoming request.
  const incoming = await api("/api/internal/connections", {}, creCookie);
  const hasIncoming = (incoming.body.incoming ?? []).some((c) => c.other?.id === bizId);
  check("creator sees incoming request", hasIncoming);

  // 3. Creator accepts.
  const connId = (incoming.body.incoming ?? []).find((c) => c.other?.id === bizId)?.id;
  const accept = await api("/api/internal/connections", {
    method: "PATCH",
    body: JSON.stringify({ connection_id: connId, action: "accept" }),
  }, creCookie);
  check("creator accepts request", accept.status === 200 && accept.body.status === "accepted");

  // 4. Business sees the friend.
  const friends = await api("/api/internal/connections", {}, bizCookie);
  const isFriend = (friends.body.friends ?? []).some((c) => c.other?.id === creId);
  check("business sees creator as friend", isFriend);

  // 5. Fixture campaign owned by the business (service role).
  const { data: camp } = await service
    .from("campaigns")
    .insert({ business_id: bizId, title: `Connections E2E ${Date.now()}`, type: "affiliate", commission_pct: 10, status: "draft", currency: "gbp", niche: ["test"] })
    .select("id")
    .single();
  ids.campaign = camp.id;

  // 6. Business invites the creator to the campaign.
  const invite = await api("/api/internal/campaign-invites", {
    method: "POST",
    body: JSON.stringify({ campaign_id: camp.id, creator_id: creId, message: "test invite" }),
  }, bizCookie);
  check("business → campaign invite", invite.status === 201, `status ${invite.status}`);
  ids.invite = invite.body.invite?.id;

  // 7. Creator sees the invite.
  const invites = await api("/api/internal/campaign-invites", {}, creCookie);
  const hasInvite = (invites.body.invites ?? []).some((i) => i.campaign_id === camp.id);
  check("creator sees invite", hasInvite);

  // 8. Creator accepts → application auto-created.
  const acceptInvite = await api("/api/internal/campaign-invites", {
    method: "PATCH",
    body: JSON.stringify({ invite_id: ids.invite, action: "accept" }),
  }, creCookie);
  check("creator accepts invite", acceptInvite.status === 200);

  const { data: app } = await service
    .from("applications")
    .select("id")
    .eq("campaign_id", camp.id)
    .eq("creator_id", creId)
    .maybeSingle();
  check("auto-apply created an application", Boolean(app?.id));
  ids.application = app?.id ?? null;

  console.log(`\n${pass} passed, ${fail} failed`);
} catch (e) {
  console.error("❌ Fatal:", e.message);
  fail++;
} finally {
  // Cleanup.
  if (ids.application) await service.from("applications").delete().eq("id", ids.application);
  if (ids.invite) await service.from("campaign_invites").delete().eq("id", ids.invite);
  if (ids.campaign) await service.from("campaigns").delete().eq("id", ids.campaign);
  if (ids.connection) await service.from("connections").delete().eq("id", ids.connection);
  console.log("Cleanup complete.");
}

process.exit(fail ? 1 : 0);
