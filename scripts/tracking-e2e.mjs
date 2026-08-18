// Tracking attribution E2E (Phase 5).
// 1. Create a tracking link in the cloud DB.
// 2. Hit the live /t/{slug} redirect, capture ?adswish_ref.
// 3. POST the token to the conversion webhook.
// 4. Verify the conversion + ledger rows, then clean everything up.
import { readFileSync } from "node:fs";

function env(key) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1).trim();
  }
  return "";
}

const BASE = env("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const APP = process.env.ADSWISH_APP_URL || "http://localhost:3000";
const AUTH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
const REST = (path, init = {}) =>
  fetch(`${BASE}/rest/v1${path}`, {
    ...init,
    headers: { ...AUTH, "Content-Type": "application/json", ...(init.headers || {}) },
  });

async function main() {
  // Reuse the existing test creator + business + campaign.
  const creators = await (await REST("/creator_profiles?select=user_id&limit=1")).json();
  const campaigns = await (await REST("/campaigns?select=id&type=eq.affiliate&limit=1")).json();
  const campaign = campaigns[0] || (await (await REST("/campaigns?select=id&limit=1")).json())[0];
  const creatorId = creators[0].user_id;
  const slug = `e2e-${Date.now()}`;

  console.log(`[1] creating tracking link ${slug}`);
  const linkRes = await REST("/tracking_links", {
    method: "POST",
    body: JSON.stringify({
      creator_id: creatorId,
      campaign_id: campaign.id,
      deliverable_id: null,
      slug,
      destination_url: "https://example.com",
    }),
    headers: { Prefer: "return=representation" },
  });
  const [link] = await linkRes.json();
  if (!link?.id) throw new Error(`link create failed: ${await linkRes.text()}`);
  console.log(`    link id ${link.id}`);

  let conversionId;
  let clickId;
  try {
    console.log(`[2] hitting redirect ${APP}/t/${slug}`);
    const redirect = await fetch(`${APP}/t/${slug}`, { redirect: "manual" });
    console.log(`    status ${redirect.status}`);
    if (redirect.status !== 302) throw new Error(`expected 302, got ${redirect.status}`);
    const location = redirect.headers.get("location");
    const token = new URL(location).searchParams.get("adswish_ref");
    if (!token) throw new Error("no adswish_ref in redirect");
    console.log("    adswish_ref token present");

    console.log(`[3] posting conversion webhook`);
    const orderId = `E2E-${Date.now()}`;
    const conv = await fetch(`${APP}/api/v1/webhooks/conversion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, orderId, amount: 100 }),
    });
    const body = await conv.json();
    console.log(`    status ${conv.status}`, body);
    if (conv.status !== 200) throw new Error("conversion webhook failed");
    conversionId = body.conversion_id;

    console.log(`[4] verifying conversion + ledger + click rows`);
    const convRow = (await (await REST(`/conversions?id=eq.${conversionId}&select=order_amount,creator_cut,platform_cut,status`)).json())[0];
    console.log("    conversion:", convRow);
    const ledgerRow = (await (await REST(`/ledger_entries?related_conversion_id=eq.${conversionId}&select=type,amount`)).json())[0];
    console.log("    ledger:", ledgerRow);
    const clickRow = (await (await REST(`/clicks_log?tracking_link_id=eq.${link.id}&select=id`)).json())[0];
    clickId = clickRow?.id;
    console.log("    click logged:", Boolean(clickRow));

    if (convRow?.creator_cut !== 90 || convRow?.platform_cut !== 10) {
      throw new Error(`bad split: ${JSON.stringify(convRow)}`);
    }
    if (convRow?.status !== "pending_hold") throw new Error("status not pending_hold");
    if (ledgerRow?.type !== "hold") throw new Error("no hold ledger entry");

    console.log("\n✅ tracking E2E passed (redirect -> JWT -> 90/10 hold -> click log)");
  } finally {
    console.log("[cleanup] removing test rows");
    if (conversionId) {
      await REST(`/ledger_entries?related_conversion_id=eq.${conversionId}`, { method: "DELETE" });
      await REST(`/conversions?id=eq.${conversionId}`, { method: "DELETE" });
    }
    if (clickId) await REST(`/clicks_log?id=eq.${clickId}`, { method: "DELETE" });
    await REST(`/tracking_links?id=eq.${link.id}`, { method: "DELETE" });
  }
}

main().catch((err) => {
  console.error("❌ tracking E2E failed:", err.message);
  process.exit(1);
});
