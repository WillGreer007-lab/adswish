// scripts/guard-live-keys.mjs
//
// Hard guard for every scripts/stripe-*.mjs: refuses to run when .env.local
// contains LIVE Stripe keys (sk_live_ / pk_live_) because those scripts create
// real charges, transfers, refunds, and connected accounts — real money.
//
// Usage from a Stripe script (top of file, before any Stripe work):
//   import { assertTestMode } from "./guard-live-keys.mjs";
//   assertTestMode();
//
// Bypass deliberately (you know what you're doing against the live account):
//   node scripts/stripe-e2e.mjs --force

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env.local");

export function liveKeyMode() {
  let env = "";
  try {
    env = fs.readFileSync(envPath, "utf8");
  } catch {
    return null; // no .env.local — nothing to check
  }
  const sk = env.match(/^STRIPE_SECRET_KEY=(.+)$/m)?.[1]?.trim() ?? "";
  const pk = env.match(/^NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=(.+)$/m)?.[1]?.trim() ?? "";
  const live = sk.startsWith("sk_live_") || pk.startsWith("pk_live_");
  return live ? { sk: sk.slice(0, 12) + "…", pk: pk.slice(0, 12) + "…" } : null;
}

export function assertTestMode() {
  const live = liveKeyMode();
  if (!live) return; // test keys or no .env.local — safe

  const forced = process.argv.includes("--force");
  if (forced) {
    console.warn(
      "⚠️  --force passed: running with LIVE Stripe keys. This moves REAL money. " +
        "You have been warned.\n",
    );
    return;
  }

  console.error(
    "\n🚫 REFUSED TO RUN — LIVE STRIPE KEYS DETECTED in .env.local\n" +
      `  STRIPE_SECRET_KEY starts with ${live.sk}\n` +
      `  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY starts with ${live.pk}\n\n` +
      "This script creates real charges/transfers/refunds. It would move REAL money.\n" +
      "Per AGENTS.md: NEVER run scripts/stripe-*.mjs while live keys are present.\n\n" +
      "To proceed anyway (NOT recommended): re-run with --force\n",
  );
  process.exit(1);
}
