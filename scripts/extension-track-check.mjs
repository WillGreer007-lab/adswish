#!/usr/bin/env node
/**
 * Live-check the exact flows the Chrome extension uses, on production:
 *  1. POST /api/v1/pixel/ping with the real business id (what the extension
 *     sends when you click "Send pixel heartbeat").
 *  2. CORS preflight (OPTIONS) — what a business domain's page triggers.
 *  3. A tracking-link redirect created exactly like the approve route does it
 *     (destination = business verified_domain, or the app domain fallback).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const SUPABASE_URL = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim();
const SERVICE_KEY = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim();
const BASE = "https://adswish-lake.vercel.app";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

// 1. Find the real business id (email lives in auth, not profiles).
const { data: users } = await sb.auth.admin.listUsers({ perPage: 200 });
const biz = (users?.users ?? []).find((u) => u.email === "willgreer38@gmail.com");
const bizId = biz?.id;
const { data: bizProfile } = await sb
  .from("business_profiles")
  .select("user_id, verified_domain, campaigns_created_month")
  .eq("user_id", bizId)
  .maybeSingle();
console.log("business:", biz?.email, "| verified_domain:", bizProfile?.verified_domain ?? "(none)", "| profile:", JSON.stringify(bizProfile ?? null).slice(0, 120));

// 2. Heartbeat exactly as the extension sends it.
const ping = await fetch(BASE + "/api/v1/pixel/ping", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ business_id: bizId }),
});
const pingBody = await ping.json();
check("pixel heartbeat (extension path)", ping.status === 200, `${ping.status} ${JSON.stringify(pingBody)}`);

// 3. CORS preflight from a foreign origin.
const pre = await fetch(BASE + "/api/v1/pixel/ping", {
  method: "OPTIONS",
  headers: { Origin: "https://some-business-store.com", "Access-Control-Request-Method": "POST" },
});
const acao = pre.headers.get("access-control-allow-origin");
check("CORS preflight allows business domains", pre.status === 204 && acao === "*", `status=${pre.status} ACAO=${acao}`);

// 4. Tracking link: create one exactly like the approve route (app-domain fallback).
const suffix = Date.now();
const creator = (users?.users ?? []).find((u) => u.email === "wgreer301@gmail.com");
const camp = await sb.from("campaigns").insert({
  business_id: bizId, title: `ExtCheck ${suffix}`, type: "affiliate", status: "active",
  commission_pct: 10, attribution_days: 30, deliverable_count: 1, niche: ["ext"],
}).select("id").single();
if (camp.error) { console.log("❌ campaign insert:", camp.error.message); }
else {
  const link = await sb.from("tracking_links").insert({
    creator_id: creator?.id, campaign_id: camp.data.id, slug: "ext" + suffix,
    destination_url: "https://adswish-lake.vercel.app",
  }).select("id, slug, destination_url").single();
  if (link.error) { console.log("❌ link insert:", link.error.message); }
  else {
    const redir = await fetch(BASE + "/t/" + link.data.slug, { redirect: "manual" });
    const loc = redir.headers.get("location") ?? "";
    const token = loc.includes("adswish_ref=") ? loc.split("adswish_ref=")[1]?.split("&")[0]?.slice(0, 20) + "…" : "(none)";
    check("tracking link redirects with token", redir.status === 302 && loc.includes("adswish_ref="), `status=${redir.status} → ${loc.slice(0, 70)} token=${token}`);

    // Conversion webhook with the real token — the extension's "track" path.
    const conv = await fetch(BASE + "/api/v1/webhooks/conversion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: loc.split("adswish_ref=")[1]?.split("&")[0], orderId: "EXT-CHECK-" + suffix, amount: 25, attribution_method: "cookie" }),
    });
    const convBody = await conv.json();
    check("conversion webhook (extension track path)", conv.status === 200, `${conv.status} ${JSON.stringify(convBody)}`);
    if (convBody.conversion_id) await sb.from("conversions").delete().eq("id", convBody.conversion_id);

    await sb.from("tracking_links").delete().eq("id", link.data.id);
  }
  await sb.from("campaigns").delete().eq("id", camp.data.id);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
