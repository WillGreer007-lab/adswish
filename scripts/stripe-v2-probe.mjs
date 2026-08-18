import { assertTestMode } from "./guard-live-keys.mjs";
assertTestMode();

import { readFileSync } from "node:fs";

function env(key) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1).trim();
  }
  return "";
}

const SK = env("STRIPE_SECRET_KEY");
const BASE = "https://api.stripe.com";
const VER = process.env.VER || "2026-07-29.preview";

async function req(method, path, body, version = VER, formEncoded = false) {
  const headers = {
    Authorization: `Bearer ${SK}`,
    "Stripe-Version": version,
  };
  let payload;
  if (body) {
    if (formEncoded) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      payload = new URLSearchParams(body).toString();
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text.slice(0, 200); }
  return { status: res.status, json };
}

async function main() {
  console.log(`Stripe-Version: ${VER}\n`);

  // 1. Create a v2 account with recipient + stripe_transfers capability.
  console.log("[1] POST /v2/core/accounts (recipient + stripe_transfers)");
  const created = await req("POST", "/v2/core/accounts", {
    contact_email: `creator-${Date.now()}@example.com`,
    display_name: "Probe Creator",
    dashboard: "express",
    identity: { country: "us", entity_type: "individual" },
    configuration: {
      merchant: {
        capabilities: { card_payments: { requested: true } },
      },
      recipient: {
        capabilities: {
          stripe_balance: { stripe_transfers: { requested: true } },
        },
      },
    },
    defaults: {
      currency: "usd",
      responsibilities: {
        fees_collector: "application",
        losses_collector: "application",
      },
      locales: ["en-US"],
    },
    include: ["configuration.recipient", "identity", "requirements"],
  });
  console.log(`  status ${created.status}`);
  const acct = created.json?.id;
  console.log("  id:", acct, "\n  body:", JSON.stringify(created.json).slice(0, 500), "\n");
  if (!acct) throw new Error("no account created");

  // 2. v1 account_links with the v2 id.
  console.log("[2] POST /v1/account_links (v1 SDK-style, no preview header)");
  const link = await req("POST", "/v1/account_links", {
    account: acct,
    refresh_url: "http://localhost:3000/refresh",
    return_url: "http://localhost:3000/return",
    type: "account_onboarding",
  }, "2024-06-20", true);
  console.log(`  status ${link.status}:`, JSON.stringify(link.json).slice(0, 300), "\n");

  console.log("[2b] POST /v1/account_links WITH preview header");
  const link2 = await req("POST", "/v1/account_links", {
    account: acct,
    refresh_url: "http://localhost:3000/refresh",
    return_url: "http://localhost:3000/return",
    type: "account_onboarding",
  }, VER, true);
  console.log(`  status ${link2.status}:`, JSON.stringify(link2.json).slice(0, 300), "\n");

  // 3. v1 transfer with the v2 id (expect "no such account" vs "insufficient funds").
  console.log("[3] POST /v1/transfers (amount 1, usd) with preview header");
  const tr = await req("POST", "/v1/transfers", {
    amount: 1,
    currency: "usd",
    destination: acct,
    description: "v2 probe",
  }, VER, true);
  console.log(`  status ${tr.status}:`, JSON.stringify(tr.json).slice(0, 300), "\n");

  console.log("[3b] POST /v1/transfers WITHOUT preview header");
  const tr2 = await req("POST", "/v1/transfers", {
    amount: 1,
    currency: "usd",
    destination: acct,
    description: "v2 probe",
  }, "2024-06-20", true);
  console.log(`  status ${tr2.status}:`, JSON.stringify(tr2.json).slice(0, 300), "\n");
}

main().catch((e) => { console.error("probe failed:", e.message); process.exit(1); });
