#!/usr/bin/env node
/**
 * Full conversion E2E on production:
 *  1. Business creates an affiliate campaign (via the real API route).
 *  2. Creator applies (real route).
 *  3. Business accepts (real route) → deliverable slots created.
 *  4. Creator submits → business approves → REAL tracking link generated.
 *  5. GET /t/{slug} → capture adswish_ref JWT.
 *  6. POST the conversion webhook → conversion row with 90/10 split + hold.
 *  7. Verify ledger + clean up every fixture.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const SUPABASE_URL = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim();
const ANON_KEY = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)[1].trim();
const SERVICE_KEY = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim();
const BASE = "https://adswish-lake.vercel.app";
const REF = SUPABASE_URL.match(/https:\/\/([^.]+)\./)[1];

const BIZ_EMAIL = "willgreer38@gmail.com";
const CREATOR_EMAIL = "wgreer301@gmail.com";
const PASSWORD = "123456";

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

async function api(path, { method = "GET", session, body } = {}) {
  const headers = {};
  if (session) headers.cookie = `sb-${REF}-auth-token=${cookieFor(session)}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text, location: res.headers.get("location") };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const service = createClient(SUPABASE_URL, SERVICE_KEY);
let campaignId = null, appId = null, deliverableIds = [], trackingLinkId = null, conversionId = null, prevTier = null, creatorUserId = null;

try {
  const biz = await login(BIZ_EMAIL, PASSWORD);
  const creator = await login(CREATOR_EMAIL, PASSWORD);
  const suffix = Date.now();

  // Micro tier can only apply to fixed campaigns — affiliate needs macro.
  // Temporarily promote for the E2E, restore in cleanup.
  creatorUserId = creator.user.id;
  const { data: cur } = await service.from("creator_profiles").select("tier").eq("user_id", creator.user.id).single();
  prevTier = cur?.tier ?? "micro";
  await service.from("creator_profiles").update({ tier: "macro" }).eq("user_id", creator.user.id);

  // 1. Business creates an affiliate campaign via the real route.
  const camp = await api("/api/internal/campaigns", {
    method: "POST",
    session: biz,
    body: {
      title: `Conversion E2E ${suffix}`,
      description: "E2E affiliate campaign",
      type: "affiliate",
      commission_pct: 10,
      attribution_days: 30,
      budget_cap: 1000,
      currency: "gbp",
      niche: ["e2e"],
      status: "active",
      visibility: "public",
      deliverable_count: 1,
      deadline_days: 14,
    },
  });
  campaignId = camp.json?.id || camp.json?.campaign?.id;
  check("Campaign created via API (affiliate)", !!campaignId, `${camp.status} ${camp.text.slice(0, 80)}`);

  // 2. Creator applies via the real route.
  const app = await api("/api/internal/applications", {
    method: "POST",
    session: creator,
    body: { campaign_id: campaignId, cover_note: "E2E application" },
  });
  check("Creator applied via API", app.status === 200 || app.status === 201, `${app.status} ${app.text.slice(0, 80)}`);

  // Accept via the business route — mirrors what the UI does.
  const listApps = await service.from("applications").select("id").eq("campaign_id", campaignId).eq("creator_id", creator.user.id).single();
  appId = listApps.data?.id;
  const accept = await api("/api/internal/applications", {
    method: "PATCH",
    session: biz,
    body: { application_id: appId, action: "accept" },
  });
  check("Business accepted application via API", accept.status === 200, `${accept.status} ${accept.text.slice(0, 80)}`);

  // 3. Deliverable slots should exist now (INSERT policy fix).
  await sleep(1000);
  const { data: delivs } = await service.from("deliverables").select("id, slot_number, status").eq("campaign_id", campaignId);
  deliverableIds = (delivs ?? []).map((d) => d.id);
  check("Deliverable slots created on accept", deliverableIds.length > 0, `${deliverableIds.length} slots`);

  // 4. Creator submits slot 1, business approves → tracking link.
  const slot = deliverableIds[0];
  const submit = await api(`/api/internal/deliverables/${slot}/submit`, {
    method: "POST",
    session: creator,
    body: { submitted_url: `https://example.com/e2e-${suffix}` },
  });
  check("Creator submitted deliverable", submit.status === 200 || submit.status === 201, `${submit.status} ${submit.text.slice(0, 80)}`);

  const approve = await api(`/api/internal/deliverables/${slot}/approve`, { method: "POST", session: biz });
  check("Business approved deliverable via API", approve.status === 200, `${approve.status} ${approve.text.slice(0, 80)}`);

  // 5. Tracking link must exist now.
  const { data: links } = await service.from("tracking_links").select("id, slug, destination_url, jti").eq("campaign_id", campaignId);
  const link = links?.[0];
  trackingLinkId = link?.id ?? null;
  check("Real tracking link generated on approval", !!link, link ? `${BASE}/t/${link.slug} → ${link.destination_url}` : "none created");

  // 6. Click the tracking link → 302 with adswish_ref JWT.
  const redir = await api(`/t/${link.slug}`);
  check("Tracking link redirects (302)", redir.status === 302, `→ ${redir.location?.slice(0, 90)}`);
  const jwt = redir.location ? new URL(redir.location).searchParams.get("adswish_ref") : null;
  check("adswish_ref JWT attached", !!jwt, jwt ? `${jwt.slice(0, 30)}…` : "missing");

  // 7. Fire the conversion webhook with that real token.
  const conv = await api("/api/v1/webhooks/conversion", {
    method: "POST",
    body: { token: jwt, orderId: `E2E-ORDER-${suffix}`, amount: 99.99, attribution_method: "cookie" },
  });
  check("Conversion webhook accepted", conv.status === 200, `${conv.status} ${conv.text.slice(0, 80)}`);

  // 8. Verify the ledger row: 90/10 split + 7-day hold.
  const { data: convRow } = await service.from("conversions").select("id, order_amount, creator_cut, platform_cut, status, hold_expires_at, attribution_method, tracking_link_id").eq("order_id", `E2E-ORDER-${suffix}`).single();
  conversionId = convRow?.id;
  check("Conversion row exists", !!convRow, convRow ? `status=${convRow.status}` : "no row");
  check("90/10 split correct", convRow && convRow.creator_cut === 89.99 && convRow.platform_cut === 10, convRow ? `creator=${convRow.creator_cut} platform=${convRow.platform_cut}` : "");
  check("7-day hold set", !!convRow?.hold_expires_at, convRow?.hold_expires_at ?? "no hold");
  check("Linked to tracking link", convRow?.tracking_link_id === trackingLinkId, "tracking_link_id matches");

  console.log(`\n${pass} passed, ${fail} failed`);
} catch (e) {
  console.error("ERROR:", e.message);
  fail++;
  console.log(`\n${pass} passed, ${fail} failed`);
} finally {
  // Cleanup
  try {
    if (prevTier && creatorUserId) await service.from("creator_profiles").update({ tier: prevTier }).eq("user_id", creatorUserId);
    if (conversionId) await service.from("conversions").delete().eq("id", conversionId);
    if (trackingLinkId) await service.from("tracking_links").delete().eq("id", trackingLinkId);
    if (deliverableIds.length) await service.from("deliverables").delete().in("id", deliverableIds);
    if (appId) await service.from("applications").delete().eq("id", appId);
    if (campaignId) await service.from("campaigns").delete().eq("id", campaignId);
    console.log("🧹 fixtures cleaned up");
  } catch (e) {
    console.error("cleanup error:", e.message);
  }
  process.exit(fail === 0 ? 0 : 1);
}
