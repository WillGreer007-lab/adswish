// Live test of the destination-charge path:
//   conversion webhook -> recordConversion (90/10 hold)
//                      -> createDestinationChargeForConversion (charge business card)
//
// Creates throwaway Stripe + Supabase fixtures, posts a conversion to the local
// webhook, verifies the PaymentIntent succeeded and the 90/10 hold was written,
// then deletes everything it created.
//
// Requires the dev server on http://localhost:3000.
import { assertTestMode } from "./guard-live-keys.mjs";
assertTestMode();

import { readFileSync } from "node:fs";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const run = "e2e" + Date.now();
const bizEmail = `${run}_biz@example.com`;
const creEmail = `${run}_cre@example.com`;

let customerId, bizUserId, creUserId, campaignId, linkId, conversionId;

async function cleanup() {
  const out = [];
  if (conversionId) {
    await supabase.from("ledger_entries").delete().eq("related_conversion_id", conversionId);
    await supabase.from("conversions").delete().eq("id", conversionId);
  }
  if (linkId) await supabase.from("tracking_links").delete().eq("id", linkId);
  if (campaignId) await supabase.from("campaigns").delete().eq("id", campaignId);
  if (bizUserId) await supabase.from("business_profiles").delete().eq("user_id", bizUserId);
  if (creUserId) await supabase.from("creator_profiles").delete().eq("user_id", creUserId);
  if (bizUserId) await supabase.auth.admin.deleteUser(bizUserId);
  if (creUserId) await supabase.auth.admin.deleteUser(creUserId);
  if (customerId) await stripe.customers.del(customerId);
  return out;
}

try {
  // 1. Stripe customer with a saved default card (simulates setup-mode checkout).
  const customer = await stripe.customers.create({ email: bizEmail, name: "E2E Biz" });
  customerId = customer.id;
  const pm = await stripe.paymentMethods.create({ type: "card", card: { token: "tok_visa" } });
  await stripe.paymentMethods.attach(pm.id, { customer: customerId });
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm.id } });
  console.log("✔ stripe customer + default card:", customerId);

  // 2. Throwaway auth users (business + creator).
  const biz = await supabase.auth.admin.createUser({
    email: bizEmail, password: "E2ePassword1!", email_confirm: true,
    app_metadata: { role: "business" },
  });
  if (biz.error) throw biz.error;
  bizUserId = biz.data.user.id;
  const cre = await supabase.auth.admin.createUser({
    email: creEmail, password: "E2ePassword1!", email_confirm: true,
    app_metadata: { role: "creator" },
  });
  if (cre.error) throw cre.error;
  creUserId = cre.data.user.id;
  console.log("✔ auth users");

  // 3. Profiles.
  await supabase.from("business_profiles").insert({
    user_id: bizUserId, company_name: "E2E Biz", account_status: "active", strikes: 0,
    average_rating: 0, kyb_status: "verified", campaigns_created_this_month: 0,
    campaigns_created_month: new Date().toISOString().slice(0, 7), onboarding_step: "complete",
    stripe_customer_id: customerId,
  });
  await supabase.from("creator_profiles").insert({
    user_id: creUserId, display_name: "E2E Creator", account_status: "active", strikes: 0,
    average_rating: 0, tier: "macro", onboarding_step: "complete",
    stripe_connect_ready: false, tax_form_status: "not_submitted",
  });
  console.log("✔ profiles");

  // 4. Campaign + tracking link.
  const campaign = await supabase.from("campaigns").insert({
    business_id: bizUserId, title: "E2E Campaign", type: "affiliate", status: "active",
  }).select("id").single();
  if (campaign.error) throw new Error("campaign insert: " + campaign.error.message);
  campaignId = campaign.data.id;
  const link = await supabase.from("tracking_links").insert({
    creator_id: creUserId, campaign_id: campaignId, slug: "e2e" + run,
    destination_url: "https://example.com",
  }).select("id").single();
  linkId = link.data.id;
  console.log("✔ campaign + tracking link");

  // 5. Sign a tracking JWT.
  const secret = new TextEncoder().encode(env.JWT_SIGNING_SECRET || "adswish-dev-tracking-secret");
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    link_id: linkId, creator_id: creUserId, campaign_id: campaignId, deliverable_id: null,
    ip_hash: "e2eip", ua_hash: "e2eua",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setJti("e2e-" + run)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(secret);

  // 6. Post the conversion (this runs recordConversion + createDestinationChargeForConversion).
  const res = await fetch("http://localhost:3000/api/v1/webhooks/conversion", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, orderId: "ORDER-" + run, amount: 100, attribution_method: "s2s" }),
  });
  const webhookResp = await res.json();
  console.log("webhook:", res.status, JSON.stringify(webhookResp));
  conversionId = webhookResp.conversion_id;
  if (!conversionId) throw new Error("no conversion id returned: " + JSON.stringify(webhookResp));

  // 7. Verify the charge + hold.
  const conv = await supabase.from("conversions")
    .select("id, status, order_amount, creator_cut, platform_cut, stripe_payment_intent_id")
    .eq("id", conversionId).single();

  let piStatus = null;
  if (conv.data?.stripe_payment_intent_id) {
    const pi = await stripe.paymentIntents.retrieve(conv.data.stripe_payment_intent_id);
    piStatus = pi.status;
  }
  const ledger = await supabase.from("ledger_entries")
    .select("type, amount").eq("related_conversion_id", conversionId);

  console.log("\n=== RESULT ===");
  console.log("conversion:", JSON.stringify(conv.data));
  console.log("payment intent status:", piStatus);
  console.log("ledger:", JSON.stringify(ledger.data));

  const pass =
    conv.data?.status === "pending_hold" &&
    conv.data?.creator_cut === 90 && conv.data?.platform_cut === 10 &&
    piStatus === "succeeded" &&
    (ledger.data ?? []).filter((l) => l.type === "hold").length === 1;

  console.log(pass
    ? "\n✅ PASS — business card charged ($100), creator 90% ($90) on hold, single hold ledger entry."
    : "\n❌ CHECK — see values above.");
} catch (err) {
  console.error("\n❌ FAILED:", err?.message ?? err);
} finally {
  await cleanup();
  console.log("\n✔ cleanup complete (stripe customer, users, profiles, campaign, link, conversion, ledger).");
}
