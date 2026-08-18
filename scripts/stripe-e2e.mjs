#!/usr/bin/env node
// Stripe test-mode end-to-end: drives the real Stripe API (sk_test_ keys) and
// posts each resulting event as a signed webhook to the running dev server
// (http://localhost:3000/api/webhooks/stripe), then verifies the Supabase rows.
//
// Covers: payment, transfer, refund, chargeback, and subscription
// create/upgrade/cancel.

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

if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
  console.error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET in .env.local");
  process.exit(1);
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let eventSeq = 0;
async function postEvent(type, object) {
  eventSeq += 1;
  const event = {
    id: `evt_e2e_${type.replace(/\./g, "_")}_${Date.now()}_${eventSeq}`,
    object: "event",
    type,
    data: { object },
  };
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: env.STRIPE_WEBHOOK_SECRET,
  });
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": signature },
    body: payload,
  });
  const text = await res.text();
  return { status: res.status, body: text, event };
}

function ok(label, cond, extra = "") {
  console.log(`  ${cond ? "✅" : "❌"} ${label}${extra ? ` — ${extra}` : ""}`);
  return cond;
}

async function resolveUserId(email) {
  const res = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`,
    { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } },
  );
  const data = await res.json();
  const u = (data.users || []).find((x) => x.email === email);
  return u?.id ?? null;
}

async function main() {
  console.log("Resolving test accounts…");
  const businessId = await resolveUserId("willgreer38@gmail.com");
  const creatorId = await resolveUserId("wgreer301@gmail.com");
  if (!businessId || !creatorId) {
    console.error("Could not resolve test account ids.", { businessId, creatorId });
    process.exit(1);
  }
  console.log(`  business=${businessId} creator=${creatorId}`);

  // ------------------------------------------------------------------
  // 1. Payment + customer setup
  // ------------------------------------------------------------------
  console.log("\n[1] Payment — customer + payment method + charge");
  const customer = await stripe.customers.create({
    email: "willgreer38@gmail.com",
    name: "GreerCo",
    payment_method: "pm_card_visa",
    invoice_settings: { default_payment_method: "pm_card_visa" },
    metadata: { user_id: businessId, role: "business" },
  });
  await supabase
    .from("business_profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("user_id", businessId);
  ok("created business customer", !!customer.id, customer.id);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: 1000, // $10.00
    currency: "usd",
    customer: customer.id,
    payment_method: "pm_card_visa",
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    metadata: { conversion_id: "e2e-payment" },
  });
  ok("payment intent succeeded", paymentIntent.status === "succeeded", paymentIntent.status);

  // Build a conversion chain so refund/chargeback handlers have a row to find.
  const { data: campaign } = await supabase
    .from("campaigns")
    .insert({
      business_id: businessId,
      title: "E2E Payment Campaign",
      type: "fixed",
      fixed_amount: 10,
      deliverable_count: 1,
      status: "active",
    })
    .select("id")
    .single();
  const { data: link } = await supabase
    .from("tracking_links")
    .insert({
      campaign_id: campaign.id,
      creator_id: creatorId,
      slug: `e2e-${Date.now()}`,
      destination_url: "https://example.com",
    })
    .select("id")
    .single();
  const { data: conversion } = await supabase
    .from("conversions")
    .insert({
      tracking_link_id: link.id,
      order_id: `E2E-${Date.now()}`,
      order_amount: 10,
      creator_cut: 9,
      platform_cut: 1,
      status: "pending_hold",
      attribution_method: "manual",
      stripe_payment_intent_id: paymentIntent.id,
    })
    .select("id, status")
    .single();
  ok("created conversion chain", !!conversion?.id, conversion?.id);

  // ------------------------------------------------------------------
  // 2. Refund
  // ------------------------------------------------------------------
  console.log("\n[2] Refund — charge.refunded");
  await stripe.refunds.create({ payment_intent: paymentIntent.id });
  const refundedCharge = await stripe.charges.retrieve(paymentIntent.latest_charge);
  const refundRes = await postEvent("charge.refunded", refundedCharge);
  ok("charge.refunded handled", refundRes.status === 200, String(refundRes.status));

  const { data: convAfterRefund } = await supabase
    .from("conversions")
    .select("status")
    .eq("id", conversion.id)
    .single();
  const { data: refundLedger } = await supabase
    .from("ledger_entries")
    .select("type, amount")
    .eq("related_conversion_id", conversion.id)
    .eq("type", "refund")
    .single();
  ok("conversion marked refunded", convAfterRefund?.status === "refunded", convAfterRefund?.status);
  ok("refund ledger entry written", !!refundLedger && Number(refundLedger.amount) < 0, refundLedger?.amount);

  // ------------------------------------------------------------------
  // 3. Chargeback (dispute)
  // ------------------------------------------------------------------
  console.log("\n[3] Chargeback — charge.dispute.closed (lost)");
  // Raw card APIs are disabled on this account, so we can't force a real
  // dispute. We charge normally, then synthesize the dispute-closed event to
  // exercise the chargeback handler (what's under test here).
  const disputePi = await stripe.paymentIntents.create({
    amount: 2500, // $25.00
    currency: "usd",
    customer: customer.id,
    payment_method: "pm_card_visa",
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    metadata: { conversion_id: "e2e-dispute" },
  });
  const { data: disputeConversion } = await supabase
    .from("conversions")
    .insert({
      tracking_link_id: link.id,
      order_id: `E2E-DSP-${Date.now()}`,
      order_amount: 25,
      creator_cut: 22.5,
      platform_cut: 2.5,
      status: "pending_hold",
      attribution_method: "manual",
      stripe_payment_intent_id: disputePi.id,
    })
    .select("id")
    .single();

  const dispute = {
    id: "dp_e2e_lost",
    object: "dispute",
    status: "lost",
    amount: 2500,
    currency: "usd",
    payment_intent: disputePi.id,
  };
  const disputeRes = await postEvent("charge.dispute.closed", dispute);
  ok("charge.dispute.closed handled", disputeRes.status === 200, String(disputeRes.status));

  const { data: convAfterDispute } = await supabase
    .from("conversions")
    .select("status")
    .eq("id", disputeConversion.id)
    .single();
  const { data: clawbackLedger } = await supabase
    .from("ledger_entries")
    .select("type, amount")
    .eq("related_conversion_id", disputeConversion.id)
    .eq("type", "chargeback_clawback")
    .single();
  ok("conversion marked chargeback", convAfterDispute?.status === "chargeback", convAfterDispute?.status);
  ok("clawback ledger entry written", !!clawbackLedger && Number(clawbackLedger.amount) < 0, clawbackLedger?.amount);

  // ------------------------------------------------------------------
  // 4. Transfer (account.updated + transfer.failed)
  // ------------------------------------------------------------------
  console.log("\n[4] Transfer — account.updated + transfer.failed");

  // account.updated: the handler only reads metadata + flags, so a synthesized
  // Connect account exercises it fully.
  const accountRes = await postEvent("account.updated", {
    id: "acct_e2e_creator",
    object: "account",
    charges_enabled: true,
    details_submitted: true,
    metadata: { user_id: creatorId },
  });
  ok("account.updated handled", accountRes.status === 200, String(accountRes.status));
  const { data: creatorProfile } = await supabase
    .from("creator_profiles")
    .select("stripe_account_id, stripe_connect_ready")
    .eq("user_id", creatorId)
    .single();
  ok(
    "creator stripe_account_id set + connect ready",
    creatorProfile?.stripe_account_id === "acct_e2e_creator" && creatorProfile?.stripe_connect_ready === true,
    `${creatorProfile?.stripe_account_id ?? "null"} / ${creatorProfile?.stripe_connect_ready}`,
  );

  // transfer.failed: revert a released conversion back to pending_hold.
  const transferId = `tr_e2e_failed_${Date.now()}`;
  const { data: transferConversion } = await supabase
    .from("conversions")
    .insert({
      tracking_link_id: link.id,
      order_id: `E2E-TRF-${Date.now()}`,
      order_amount: 9,
      creator_cut: 8.1,
      platform_cut: 0.9,
      status: "released",
      attribution_method: "manual",
      stripe_transfer_id: transferId,
    })
    .select("id")
    .single();
  const failedRes = await postEvent("transfer.failed", {
    id: transferId,
    object: "transfer",
  });
  ok("transfer.failed handled", failedRes.status === 200, String(failedRes.status));
  const { data: convAfterTransferFail } = await supabase
    .from("conversions")
    .select("status")
    .eq("id", transferConversion.id)
    .single();
  ok("conversion re-held after transfer.failed", convAfterTransferFail?.status === "pending_hold", convAfterTransferFail?.status);

  // Best-effort real transfer (requires Connect Accounts v2 on this account).
  try {
    const account = await stripe.accounts.create({
      type: "custom",
      country: "US",
      capabilities: { transfers: { requested: true } },
      external_account: {
        object: "bank_account",
        country: "US",
        currency: "usd",
        account_number: "000123456789",
        routing_number: "110000000",
      },
      metadata: { user_id: creatorId },
    });
    const transfer = await stripe.transfers.create({ amount: 900, currency: "usd", destination: account.id });
    const transferRes = await postEvent("transfer.paid", { ...transfer, amount: 900, amount_reversed: 0 });
    ok("transfer.paid handled (real)", transferRes.status === 200, String(transferRes.status));
  } catch (err) {
    console.log(`  ⚠️ real transfer skipped: ${String(err.message).split("\n")[0]}`);
  }

  // ------------------------------------------------------------------
  // 5. Subscription create / upgrade / cancel
  // ------------------------------------------------------------------
  console.log("\n[5] Subscription — create / upgrade / cancel");
  const product = await stripe.products.create({ name: "Adswish Growth" });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 700,
    currency: "usd",
    recurring: { interval: "month" },
  });
  const priceUpgraded = await stripe.prices.create({
    product: product.id,
    unit_amount: 1500,
    currency: "usd",
    recurring: { interval: "month" },
  });

  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: price.id }],
    metadata: { user_id: businessId, role: "business", plan_slug: "business_growth" },
  });
  const createdRes = await postEvent("customer.subscription.created", sub);
  ok("subscription.created handled", createdRes.status === 200, String(createdRes.status));

  let { data: businessSub } = await supabase
    .from("business_subscriptions")
    .select("plan_slug, status")
    .eq("stripe_subscription_id", sub.id)
    .single();
  ok(
    "subscription row created (business_growth)",
    businessSub?.plan_slug === "business_growth" && businessSub?.status === "active",
    `${businessSub?.plan_slug}/${businessSub?.status}`,
  );

  // Upgrade
  const upgraded = await stripe.subscriptions.update(sub.id, {
    items: [{ id: sub.items.data[0].id, price: priceUpgraded.id }],
    proration_behavior: "none",
    metadata: { user_id: businessId, role: "business", plan_slug: "business_enterprise" },
  });
  const updatedRes = await postEvent("customer.subscription.updated", upgraded);
  ok("subscription.updated handled", updatedRes.status === 200, String(updatedRes.status));

  businessSub = (
    await supabase.from("business_subscriptions").select("plan_slug, status").eq("stripe_subscription_id", sub.id).single()
  ).data;
  ok(
    "subscription upgraded (business_enterprise)",
    businessSub?.plan_slug === "business_enterprise",
    businessSub?.plan_slug,
  );

  // Cancel
  const canceled = await stripe.subscriptions.cancel(sub.id);
  const deletedRes = await postEvent("customer.subscription.deleted", canceled);
  ok("subscription.deleted handled", deletedRes.status === 200, String(deletedRes.status));

  businessSub = (
    await supabase.from("business_subscriptions").select("status, canceled_at").eq("stripe_subscription_id", sub.id).single()
  ).data;
  ok("subscription canceled", businessSub?.status === "canceled" && !!businessSub?.canceled_at, businessSub?.status);

  console.log("\nE2E complete.");
}

main().catch((err) => {
  console.error("E2E failed:", err);
  process.exit(1);
});
