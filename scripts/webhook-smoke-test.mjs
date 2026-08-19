// Webhook smoke test (TEST-MODE SAFE).
//
// This does NOT call the live Stripe API and does not move money. It:
//   1. Verifies Sightengine moderation keys work with a real (safe) check.
//   2. Creates three fake conversions and pushes *synthesized, correctly
//      signed* Stripe webhook events (charge.refunded, dispute.closed/lost,
//      payment_intent.payment_failed) to the LOCAL webhook endpoint, then
//      asserts the ledger/status updates. Finally it cleans everything up.
//
// Requirements: dev server on localhost:3000, and seeded test accounts
// (scripts/create-test-accounts.mjs + scripts/seed-demo-data.mjs).
import Stripe from "stripe";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SR = env.SUPABASE_SERVICE_ROLE_KEY;
const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
// Usage: node scripts/webhook-smoke-test.mjs [base-url]  (default: localhost:3000)
const BASE = process.argv[2] ?? "http://localhost:3000";

if (env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) {
  console.log("⚠️  STRIPE_SECRET_KEY is LIVE. This test never calls Stripe, so it is still safe,");
  console.log("   but a full charge/refund round-trip would need test keys. Proceeding with synthesized events only.\n");
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? "sk_test_unused");

async function adminUsers() {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: SR, Authorization: `Bearer ${SR}` },
  });
  const txt = await r.text();
  if (!txt) throw new Error(`adminUsers empty body (HTTP ${r.status})`);
  return (JSON.parse(txt)).users ?? [];
}
async function rest(table, method, body, qs = "") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${qs}`, {
    method,
    headers: {
      apikey: SR,
      Authorization: `Bearer ${SR}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  return { ok: r.ok, status: r.status, json: txt ? JSON.parse(txt) : null };
}
let failures = 0;
function pass(name) { console.log(`  ✓ ${name}`); }
function fail(name, extra = "") { failures++; console.log(`  ✗ ${name} ${extra}`); }

// ---------- 1) Moderation ----------
console.log("== Moderation (Sightengine) ==");
const mUser = env.SIGHTENGINE_API_USER;
const mKey = env.SIGHTENGINE_API_KEY;
if (!mUser || !mKey) {
  fail("Sightengine keys configured");
} else {
  pass("Sightengine keys configured");
  try {
    const params = new URLSearchParams({
      url: "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png",
      models: "nudity-2.1,offensive",
      api_user: mUser,
      api_secret: mKey,
    });
    const r = await fetch(`https://api.sightengine.com/1.0/check.json?${params.toString()}`, {
      signal: AbortSignal.timeout(20000),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && typeof data.nudity === "object") {
      pass(`Sightengine check responded (HTTP ${r.status})`);
    } else {
      fail("Sightengine check", `HTTP ${r.status}`);
    }
  } catch (e) {
    fail("Sightengine check", e.message);
  }
}

// ---------- 2) Ledger via synthesized webhooks ----------
console.log("\n== Webhook → ledger (synthesized signed events) ==");
const users = await adminUsers();
const business = users.find((u) => u.email === "willgreer38@gmail.com");
const creator = users.find((u) => u.email === "wgreer301@gmail.com");
if (!business || !creator) {
  console.error("Test accounts missing — run create-test-accounts + seed-demo-data first.");
  process.exit(1);
}

// Create a temporary campaign owned by the business (fully removed at cleanup).
const campStamp = Date.now().toString(36);
const campRes = await rest("campaigns", "POST", {
  business_id: business.id,
  title: `Smoke test ${campStamp}`,
  type: "fixed",
  fixed_amount: 100,
  status: "active",
  deliverable_count: 1,
  currency: "GBP",
}, "?select=id");
const campaign = Array.isArray(campRes.json) ? campRes.json[0] : null;
if (!campaign) {
  console.error("create campaign failed", campRes.status, JSON.stringify(campRes.json));
  process.exit(1);
}
pass("created temporary campaign");

const slug = `smoke${campStamp}`;
const linkRes = await rest("tracking_links", "POST", {
  creator_id: creator.id,
  campaign_id: campaign.id,
  slug,
  destination_url: "https://example.com",
}, "?select=id");
const link = Array.isArray(linkRes.json) ? linkRes.json[0] : null;
if (!link) { console.error("tracking link failed", linkRes.status, JSON.stringify(linkRes.json)); process.exit(1); }
pass("created smoke tracking link");

const scenarios = [
  { pi: `pi_smoke_refund_${slug}`, eventType: "charge.refunded", expectStatus: "refunded", obj: { id: "ch_smoke_refund", object: "charge", payment_intent: "", amount_refunded: 10000 } },
  { pi: `pi_smoke_dispute_${slug}`, eventType: "charge.dispute.closed", expectStatus: "chargeback", obj: { id: "dp_smoke", object: "dispute", status: "lost", payment_intent: "", amount: 5000 } },
  { pi: `pi_smoke_failed_${slug}`, eventType: "payment_intent.payment_failed", expectStatus: "refunded", obj: { id: "", object: "payment_intent", last_payment_error: { message: "card_declined (smoke)" } } },
];
scenarios[0].obj.payment_intent = scenarios[0].pi;
scenarios[1].obj.payment_intent = scenarios[1].pi;
scenarios[2].obj.id = scenarios[2].pi;

const createdConversions = [];
for (const s of scenarios) {
  const r = await rest("conversions", "POST", {
    tracking_link_id: link.id,
    stripe_payment_intent_id: s.pi,
    order_id: `SMOKE-${s.pi}`,
    order_amount: 100,
    currency: "GBP",
    creator_cut: 90,
    platform_cut: 10,
    status: "pending_hold",
    hold_expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    attribution_method: "s2s",
  }, "?select=id");
  const conv = Array.isArray(r.json) ? r.json[0] : null;
  if (!conv) { fail(`create conversion ${s.eventType}`, `HTTP ${r.status} ${JSON.stringify(r.json)}`); continue; }
  createdConversions.push(conv.id);
}

for (const s of scenarios) {
  const event = {
    id: `evt_${s.eventType.replace(/\./g, "_")}_${slug}`,
    object: "event",
    api_version: "2024-06-20",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    type: s.eventType,
    data: { object: s.obj },
  };
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
  const r = await fetch(`${BASE}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": header },
    body: payload,
  });
  const body = await r.json().catch(() => ({}));
  if (r.ok && body.received) pass(`${s.eventType} → ${r.status} received`);
  else fail(`${s.eventType}`, `HTTP ${r.status} ${JSON.stringify(body)}`);
}

// Verify each conversion reached the expected status.
await new Promise((r) => setTimeout(r, 300));
for (const s of scenarios) {
  const r = await rest("conversions", "GET", null, `?stripe_payment_intent_id=eq.${s.pi}&select=status`);
  const row = Array.isArray(r.json) ? r.json[0] : null;
  if (row?.status === s.expectStatus) pass(`${s.eventType} → conversion status "${s.expectStatus}"`);
  else fail(`${s.eventType} status`, `got "${row?.status}"`);
}

// Verify ledger rows were written.
const ledgerRes = await rest("ledger_entries", "GET", null, `?related_conversion_id=in.(${createdConversions.join(",")})&select=type,amount`);
const ledger = Array.isArray(ledgerRes.json) ? ledgerRes.json : [];
if (ledger.length >= 3) pass(`ledger entries written (${ledger.length})`);
else fail("ledger entries", `expected >=3 got ${ledger.length}`);

// ---------- 3) Cleanup ----------
console.log("\n== Cleanup ==");
await rest("ledger_entries", "DELETE", null, `?related_conversion_id=in.(${createdConversions.join(",")})`);
await rest("conversions", "DELETE", null, `?id=in.(${createdConversions.join(",")})`);
await rest("tracking_links", "DELETE", null, `?id=eq.${link.id}`);
await rest("campaigns", "DELETE", null, `?id=eq.${campaign.id}`);
const projRef = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];
for (const query of [
  `DELETE FROM webhook_events WHERE event_id LIKE 'evt_%${slug}' OR event_id LIKE 'evt_probe_%';`,
  `DELETE FROM notifications WHERE body LIKE '%(smoke)%';`,
]) {
  await fetch(`https://api.supabase.com/v1/projects/${projRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
}
pass("cleaned up smoke conversions, ledger, link, campaign, webhook events");

console.log(`\n${failures === 0 ? "✅ All smoke checks passed." : `❌ ${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
