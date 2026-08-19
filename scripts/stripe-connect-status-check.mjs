// READ-ONLY. Reports the platform Stripe account's Connect onboarding status.
// Makes no charges, transfers, or writes — safe with live keys.
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const key = env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}

const get = async (path) => {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  return res.ok ? res.json() : { error: `HTTP ${res.status}: ${await res.text()}` };
};

const acct = await get("account");
if (acct.error) {
  console.error("account:", acct.error);
  process.exit(1);
}

const req = acct.requirements ?? {};
console.log("Platform account:", acct.id, `(${acct.country})`);
console.log("charges_enabled:", acct.charges_enabled);
console.log("payouts_enabled:", acct.payouts_enabled);
console.log("details_submitted:", acct.details_submitted);
console.log("capabilities:", JSON.stringify(acct.capabilities ?? {}, null, 2));
console.log("currently_due:", JSON.stringify(req.currently_due ?? [], null, 2));
console.log("eventually_due:", JSON.stringify(req.eventually_due ?? [], null, 2));
console.log("errors:", JSON.stringify(req.errors ?? [], null, 2));

// What the platform profile still needs (business + bank), if anything.
const profile = acct.settings?.dashboard?.display_name ?? "—";
console.log("dashboard display name:", profile);
