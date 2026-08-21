/**
 * One-shot Resend setup checker (values never printed).
 * 1. Validates RESEND_API_KEY against the Resend API.
 * 2. Lists domains + their DNS record status.
 * 3. If the domain is verified, sends a test email to a given address.
 *
 * Usage: node scripts/email-setup.mjs [test-recipient@example.com]
 */
import fs from "node:fs";

function readKey(path) {
  if (!fs.existsSync(path)) return null;
  const m = fs.readFileSync(path, "utf8").match(/^RESEND_API_KEY=(.*)$/m);
  if (!m) return null;
  const v = m[1].trim().replace(/^["']|["']$/g, "");
  return v && v.startsWith("re_") && v.length > 20 ? v : null;
}

const key = readKey(".env.local") ?? readKey("vercel-env.txt");
if (!key) {
  console.log("❌ No valid RESEND_API_KEY found in .env.local or vercel-env.txt");
  console.log("   → Create one at resend.com → API Keys → Create API Key, then");
  console.log("     add RESEND_API_KEY=<key> to .env.local (and vercel-env.txt).");
  process.exit(1);
}

const recipient = process.argv[2];
console.log("✅ Found a Resend API key. Checking account…");

const res = await fetch("https://api.resend.com/domains", {
  headers: { Authorization: `Bearer ${key}` },
});
if (!res.ok) {
  console.log(`❌ Resend API rejected the key (HTTP ${res.status}).`);
  console.log("   → The key is invalid/rotated. Create a fresh one at resend.com → API Keys.");
  process.exit(1);
}

const { data: domains } = await res.json();
console.log(`\nDomains on this account (${domains?.length ?? 0}):`);
let verifiedDomain = null;
for (const d of domains ?? []) {
  console.log(`  • ${d.name} — status: ${d.status}`);
  if (d.status === "verified" && d.name === "adswish.com") verifiedDomain = d;
  for (const r of d.records ?? []) {
    console.log(`      ${r.record} (${r.type}) ${r.name} → ${r.value} [${r.status}]`);
  }
}

if (verifiedDomain) {
  console.log("\n✅ adswish.com is VERIFIED — email will send.");
} else {
  console.log("\n⚠️ adswish.com is NOT verified yet.");
  console.log("   → Add the DNS records listed above to your DNS provider, then");
  console.log("     Resend verifies automatically (usually within minutes).");
}

if (recipient && (verifiedDomain || domains?.some((d) => d.status === "verified"))) {
  console.log(`\nSending a test email to ${recipient}…`);
  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Adswish <onboarding@adswish.com>",
      to: [recipient],
      subject: "Adswish email test ✓",
      text: "This is a test email from Adswish. If you received it, Resend is fully wired up.",
      html: "<p>This is a test email from <strong>Adswish</strong>. If you received it, Resend is fully wired up.</p>",
    }),
  });
  const j = await send.json();
  console.log(send.ok ? `✅ Sent! (id ${j.id}) — check the inbox + spam folder.` : `❌ ${send.status}: ${JSON.stringify(j)}`);
}
