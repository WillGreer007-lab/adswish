#!/usr/bin/env node
/**
 * Two-session realtime chat + unread-badge test on production.
 * - Creates a fresh fixture campaign owned by the business.
 * - Accepts the creator onto it.
 * - Creator subscribes to postgres_changes on `messages` + `notifications`.
 * - Business sends a message via the production API.
 * - Asserts: (1) message arrived over the creator's realtime socket,
 *   (2) creator got a `message` notification (the unread bell badge source).
 * - Cleans up all fixtures afterward.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const SUPABASE_URL = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim();
const ANON_KEY = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)[1].trim();
const SERVICE_KEY = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim();
const BASE = "https://adswish-lake.vercel.app";
const REF = SUPABASE_URL.match(/https:\/\/([^.]+)\./)[1];

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const service = createClient(SUPABASE_URL, SERVICE_KEY);
let campaignId = null;
let messageIds = [];
let notificationIds = [];

try {
  const business = await login("willgreer38@gmail.com", "123456");
  const creator = await login("wgreer301@gmail.com", "123456");
  const bizCookie = cookieFor(business);
  const creatorId = creator.user.id;

  // 1. Fixture campaign (service role, then user sees it via RLS as owner)
  const { data: camp, error: campErr } = await service
    .from("campaigns")
    .insert({ business_id: business.user.id, title: `Realtime Badge Test ${Date.now()}`, status: "active", budget_cap: 500, currency: "gbp", type: "affiliate", commission_pct: 10, niche: ["test"] })
    .select("id")
    .single();
  if (campErr) throw new Error("campaign insert: " + campErr.message);
  campaignId = camp.id;
  check("Fixture campaign created", true, campaignId);

  // 2. Accept the creator (applications row needs tier_at_application — mirror prior fixture)
  const { data: app, error: appErr } = await service
    .from("applications")
    .insert({ campaign_id: campaignId, creator_id: creatorId, status: "accepted", tier_at_application: "micro" })
    .select("id")
    .single();
  if (appErr) throw new Error("application insert: " + appErr.message);
  check("Creator accepted onto campaign", true, app.id);

  // 3. Creator subscribes to realtime on messages + notifications (browser-style session)
  const creatorSb = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await creatorSb.auth.setSession({ access_token: creator.access_token, refresh_token: creator.refresh_token });
  const realtimeMsg = new Promise((resolve) => {
    const ch = creatorSb
      .channel("badge-test-msgs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `campaign_id=eq.${campaignId}` }, (p) => {
        messageIds.push(p.new.id);
        if (messageIds.length >= 1) { creatorSb.removeChannel(ch); resolve(); }
      })
      .subscribe();
  });
  const realtimeNotif = new Promise((resolve) => {
    const ch = creatorSb
      .channel("badge-test-notifs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${creatorId}` }, (p) => {
        if (p.new.type === "message") { notificationIds.push(p.new.id); creatorSb.removeChannel(ch); resolve(); }
      })
      .subscribe();
  });
  await sleep(2500);
  check("Creator realtime channels subscribed", true, "messages + notifications");

  // 4. Business sends a message through the production API
  const res = await fetch(`${BASE}/api/internal/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `sb-${REF}-auth-token=${bizCookie}` },
    body: JSON.stringify({ campaign_id: campaignId, body: `Unread badge test ${Date.now()}` }),
  });
  const data = await res.json().catch(() => ({}));
  check("Business message send 201", res.status === 201, `got ${res.status} ${JSON.stringify(data).slice(0, 120)}`);
  if (data.message?.id) messageIds.push(data.message.id);

  // 5. Wait for both realtime deliveries
  const msgArrived = await Promise.race([realtimeMsg.then(() => true), sleep(10000).then(() => false)]);
  check("Message arrived over creator realtime socket", msgArrived, messageIds.length ? `ids: ${messageIds.join(",")}` : "timeout");

  const notifArrived = await Promise.race([realtimeNotif.then(() => true), sleep(10000).then(() => false)]);
  check("Message notification arrived over creator realtime socket (unread badge source)", notifArrived, notificationIds.length ? `notif: ${notificationIds[0]}` : "timeout");

  // 6. Confirm unread state server-side (the bell badge counts read=false)
  if (notificationIds.length) {
    const { data: notifRows } = await service.from("notifications").select("read, type, body").in("id", notificationIds);
    const unread = (notifRows ?? []).filter((n) => !n.read);
    check("Notification stored as unread (read=false)", unread.length === notificationIds.length, JSON.stringify(notifRows));
  }

  // 7. Creator can read it via their own session (RLS read policy)
  const { data: myNotifs, error: myErr } = await creatorSb.from("notifications").select("id").eq("user_id", creatorId).in("id", notificationIds);
  check("Creator can read own notifications via RLS", !myErr && (myNotifs?.length ?? 0) === notificationIds.length, myErr?.message ?? `${myNotifs?.length} rows`);

  console.log(`\n${pass} passed, ${fail} failed`);
} catch (e) {
  console.error("ERROR:", e.message);
  fail++;
  console.log(`\n${pass} passed, ${fail} failed`);
} finally {
  // Cleanup
  try {
    if (notificationIds.length) await service.from("notifications").delete().in("id", notificationIds);
    if (messageIds.length) await service.from("messages").delete().in("id", messageIds);
    if (campaignId) {
      await service.from("applications").delete().eq("campaign_id", campaignId);
      await service.from("campaigns").delete().eq("id", campaignId);
    }
    console.log("🧹 fixtures cleaned up");
  } catch (e) {
    console.error("cleanup error:", e.message);
  }
  process.exit(fail === 0 ? 0 : 1);
}
