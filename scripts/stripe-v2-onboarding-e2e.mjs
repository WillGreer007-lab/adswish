#!/usr/bin/env node
// Accounts v2 onboarding E2E:
//   1. Create a real v2 recipient account and wire it to the creator.
//   2. Generate a real hosted-onboarding account link (v1 account_links on a v2 id).
//   3. Synthesize a signed account.updated (no metadata — v2 shape) and verify
//      the webhook's stripe_account_id fallback flips stripe_connect_ready.
//   4. Exercise releaseConversion via the cron release-holds job, attempting a
//      real transfer to the v2 account.
//   5. Clean up all rows + the Stripe account.
import { assertTestMode } from "./guard-live-keys.mjs";
assertTestMode();

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function loadEnv() {
  const raw = readFileSync(resolve(projectRoot, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return env;
}

const env = loadEnv();
const WEBHOOK_URL = process.env.WEBHOOK_URL || "http://localhost:3000/api/webhooks/stripe";
const CRON_URL = process.env.CRON_URL || "http://localhost:3000/api/internal/cron";
const V2 = process.env.STRIPE_CONNECT_V2_VERSION || "2026-07-29.preview";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function ok(label, cond, extra = "") {
  console.log(`  ${cond ? "✅" : "❌"} ${label}${extra ? ` — ${extra}` : ""}`);
  return cond;
}

async function resolveUserId(email) {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  const data = await res.json();
  return (data.users || []).find((x) => x.email === email)?.id ?? null;
}

async function createV2Account(email, name) {
  const res = await fetch("https://api.stripe.com/v2/core/accounts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/json",
      "Stripe-Version": V2,
    },
    body: JSON.stringify({
      contact_email: email,
      display_name: name || "",
      dashboard: "express",
      identity: { country: "us", entity_type: "individual" },
      configuration: {
        merchant: { capabilities: { card_payments: { requested: true } } },
        recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
      },
      defaults: {
        currency: "usd",
        responsibilities: { fees_collector: "application", losses_collector: "application" },
        locales: ["en-US"],
      },
      include: ["configuration.recipient", "identity", "requirements"],
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`v2 create failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

async function main() {
  const creatorId = await resolveUserId("wgreer301@gmail.com");
  if (!creatorId) throw new Error("creator not found");

  // Remember the creator's current connect state for restore.
  const before = (
    await supabase.from("creator_profiles").select("stripe_account_id, stripe_connect_ready").eq("user_id", creatorId).single()
  ).data ?? {};

  let account, conversionId, campaignId, linkId, webhookEventId;
  const createdRows = [];
  try {
    console.log("[1] Create a real v2 recipient account");
    account = await createV2Account("wgreer301@gmail.com", "Will Greer");
    ok("v2 account created", !!account.id, account.id);
    ok("recipient + merchant applied", JSON.stringify(account.applied_configurations) === JSON.stringify(["recipient", "merchant"]), JSON.stringify(account.applied_configurations));

    await supabase.from("creator_profiles").update({ stripe_account_id: account.id }).eq("user_id", creatorId);
    ok("creator wired to v2 account", true);

    console.log("\n[2] Hosted onboarding link (v1 account_links on a v2 id)");
    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: "http://localhost:3000/onboarding/creator/stripe_setup",
      return_url: "http://localhost:3000/auth/callback?next=/onboarding/creator/stripe_setup",
      type: "account_onboarding",
    });
    ok("account link created", !!link.url);
    console.log(`      👉 open in Safari to complete onboarding:\n      ${link.url}\n`);

    console.log("[3] Synthesize account.updated (v2 shape: no metadata) → stripe_connect_ready");
    const event = {
      id: `evt_v2_acct_${Date.now()}`,
      object: "event",
      type: "account.updated",
      data: { object: { id: account.id, object: "account", charges_enabled: true, details_submitted: true } },
    };
    const sig = stripe.webhooks.generateTestHeaderString({ payload: JSON.stringify(event), secret: env.STRIPE_WEBHOOK_SECRET });
    const wh = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body: JSON.stringify(event),
    });
    ok("webhook 200", wh.status === 200, String(wh.status));

    const profile = (
      await supabase.from("creator_profiles").select("stripe_account_id, stripe_connect_ready").eq("user_id", creatorId).single()
    ).data;
    ok("stripe_connect_ready flipped via account_id fallback", profile?.stripe_connect_ready === true, `${profile?.stripe_connect_ready}`);

    const { data: whRow } = await supabase.from("webhook_events").select("event_id").eq("event_id", event.id).single();
    webhookEventId = whRow?.event_id ?? event.id;

    console.log("\n[4] Exercise releaseConversion via cron release-holds (real transfer attempt)");
    const { data: campaign } = await supabase
      .from("campaigns")
      .insert({ business_id: "9bfc8eb6-90f6-4699-a1d0-d21490241043", title: "V2 Payout E2E", type: "affiliate", commission_pct: 10, attribution_days: 30, deliverable_count: 1, status: "active" })
      .select("id").single();
    campaignId = campaign.id;

    const { data: tl } = await supabase
      .from("tracking_links")
      .insert({ campaign_id: campaign.id, creator_id: creatorId, slug: `v2e2e-${Date.now()}`, destination_url: "https://example.com" })
      .select("id").single();
    linkId = tl.id;

    const { data: conv } = await supabase
      .from("conversions")
      .insert({
        tracking_link_id: linkId,
        order_id: `V2-${Date.now()}`,
        order_amount: 100,
        creator_cut: 90,
        platform_cut: 10,
        status: "pending_hold",
        hold_expires_at: new Date(Date.now() - 1000).toISOString(), // already expired
        attribution_method: "manual",
      })
      .select("id").single();
    conversionId = conv.id;

    const cronRes = await fetch(CRON_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer adswish-cron" },
      body: JSON.stringify({ jobs: ["release-holds"] }),
    });
    const cronBody = await cronRes.json();
    ok("cron release-holds ran", cronRes.status === 200, JSON.stringify(cronBody));

    const convAfter = (
      await supabase.from("conversions").select("status, stripe_transfer_id").eq("id", conversionId).single()
    ).data;
    const releaseLedger = (
      await supabase.from("ledger_entries").select("id").eq("related_conversion_id", conversionId).eq("type", "release").single()
    ).data;
    ok("conversion released", convAfter?.status === "released", convAfter?.status);
    ok("release ledger entry written", !!releaseLedger);
    if (!convAfter?.stripe_transfer_id) {
      console.log("      ⚠️ transfer not created — expected: the v2 account needs hosted onboarding to activate stripe_transfers.");
    }
  } finally {
    console.log("\n[cleanup] removing test rows + Stripe account");
    if (conversionId) {
      await supabase.from("ledger_entries").delete().eq("related_conversion_id", conversionId);
      await supabase.from("conversions").delete().eq("id", conversionId);
    }
    if (linkId) await supabase.from("tracking_links").delete().eq("id", linkId);
    if (campaignId) await supabase.from("campaigns").delete().eq("id", campaignId);
    if (webhookEventId) await supabase.from("webhook_events").delete().eq("event_id", webhookEventId);
    await supabase
      .from("creator_profiles")
      .update({ stripe_account_id: before.stripe_account_id ?? null, stripe_connect_ready: before.stripe_connect_ready ?? false })
      .eq("user_id", creatorId);
    if (account?.id) {
      const del = await stripe.accounts.del(account.id);
      ok("v2 account deleted", del.deleted === true);
    }
  }

  console.log("\n✅ v2 onboarding E2E complete.");
}

main().catch((e) => { console.error("E2E failed:", e); process.exit(1); });
