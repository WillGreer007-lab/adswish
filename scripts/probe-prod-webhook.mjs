// Probe: does the local STRIPE_WEBHOOK_SECRET verify against the production
// webhook endpoint? Sends ONE signed (harmless) event. If it returns 400
// "Invalid signature", the secrets differ and the user must provide the prod
// secret. If 200, the secret matches and the full smoke test can run.
import Stripe from "stripe";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const secret = env.STRIPE_WEBHOOK_SECRET;
const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? "sk_test_unused");
const BASE = process.argv[2] ?? "https://adswish-lake.vercel.app";

const stamp = Date.now().toString(36);
const event = {
  id: `evt_probe_${stamp}`,
  object: "event",
  api_version: "2024-06-20",
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  type: "charge.refunded",
  data: {
    object: {
      id: `ch_probe_${stamp}`,
      object: "charge",
      payment_intent: `pi_probe_${stamp}`,
      amount_refunded: 10000,
    },
  },
};
const payload = JSON.stringify(event);
const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
const res = await fetch(`${BASE}/api/webhooks/stripe`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "stripe-signature": header },
  body: payload,
});
const body = await res.text();
console.log(`${BASE}/api/webhooks/stripe -> ${res.status} ${body.slice(0, 200)}`);
if (res.status === 200) console.log("SECRET_MATCHES");
else console.log("SECRET_MISMATCH (need the production webhook secret)");
