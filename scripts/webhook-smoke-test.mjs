#!/usr/bin/env node
/**
 * Webhook smoke test — verifies the DEPLOYED endpoint accepts correctly-signed
 * Stripe events and rejects bad signatures. Uses fabricated event objects with
 * fake IDs; handlers no-op on unknown IDs. Touches NO real money.
 *
 * Usage: node scripts/webhook-smoke-test.mjs [--url https://adswish-lake.vercel.app]
 * Reads STRIPE_WEBHOOK_SECRET from .env.local.
 */
import { readFileSync } from "node:fs";
import { createHmac, timingSafeEqual } from "node:crypto";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const secret = env.match(/^STRIPE_WEBHOOK_SECRET=(.+)$/m)?.[1]?.trim();
if (!secret) {
  console.error("STRIPE_WEBHOOK_SECRET not found in .env.local");
  process.exit(1);
}
if (/^sk_live_/.test(env.match(/^STRIPE_SECRET_KEY=(.+)$/m)?.[1] ?? "")) {
  console.log("⚠ Live keys detected — this test only fabricates events (no API calls to Stripe). Safe.");
}

const baseUrl = process.argv[2] === "--url" ? process.argv[3] : "https://adswish-lake.vercel.app";
const endpoint = `${baseUrl}/api/webhooks/stripe`;

function sign(body) {
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return { header: `t=${t},v1=${sig}`, t };
}

function makeEvent(type, object) {
  return {
    id: `evt_smoketest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    object: "event",
    api_version: "2026-07-29.dahlia",
    created: Math.floor(Date.now() / 1000),
    data: { object },
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type,
  };
}

async function post(body, signature) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body,
  });
  return { status: res.status, body: await res.text() };
}

let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
}

// 1. Bad signature must be rejected
{
  const body = JSON.stringify(makeEvent("charge.refunded", { id: "ch_fake" }));
  const res = await post(body, "t=1,v1=bogus");
  check("Bad signature rejected (400)", res.status === 400, `got ${res.status}`);
}

// 2. Correctly-signed events must be accepted (proves the deployed secret matches)
const scenarios = [
  ["charge.refunded", { id: "ch_smoketest", payment_intent: "pi_smoketest", amount_refunded: 1000, currency: "gbp" }],
  ["payment_intent.payment_failed", { id: "pi_smoketest", last_payment_error: { message: "test decline" } }],
  ["charge.dispute.closed", { id: "dp_smoketest", payment_intent: "pi_smoketest", status: "lost", amount: 1000 }],
  ["payment_intent.succeeded", { id: "pi_smoketest" }],
  ["account.updated", { id: "acct_smoketest", charges_enabled: true, details_submitted: true }],
  ["checkout.session.completed", { id: "cs_smoketest", mode: "setup", customer: "cus_smoketest", metadata: {} }],
];

for (const [type, object] of scenarios) {
  const body = JSON.stringify(makeEvent(type, object));
  const { header } = sign(body);
  const res = await post(body, header);
  const ok = res.status === 200;
  check(`Signed ${type} accepted (200)`, ok, `got ${res.status}: ${res.body.slice(0, 120)}`);
  if (ok) {
    // 3. Idempotency — replay the identical event must be flagged duplicate
    const res2 = await post(body, header);
    const dup = res2.status === 200 && /duplicate/.test(res2.body);
    check(`Replay of ${type} flagged duplicate`, dup, `got ${res2.status}: ${res2.body.slice(0, 120)}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
