#!/usr/bin/env node
/**
 * Create a persistent demo affiliate campaign + tracking link on production so
 * there is a REAL /t/{slug} link to click and test the extension against.
 * Leave it in place (it doubles as fixture data the user can delete).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const SUPABASE_URL = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim();
const SERVICE_KEY = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim();
const BASE = "https://adswish-lake.vercel.app";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const { data: users } = await sb.auth.admin.listUsers({ perPage: 200 });
const biz = (users?.users ?? []).find((u) => u.email === "willgreer38@gmail.com");
const creator = (users?.users ?? []).find((u) => u.email === "wgreer301@gmail.com");
if (!biz || !creator) { console.log("users not found"); process.exit(1); }

// Free-plan counter guard.
await sb.from("business_profiles").update({ campaigns_created_this_month: 0, campaigns_created_month: new Date().toISOString().slice(0, 7) }).eq("user_id", biz.id);

const camp = await sb.from("campaigns").insert({
  business_id: biz.id,
  title: "Demo tracking link — try the extension",
  description: "Persistent demo campaign with a live tracking link. Delete from the business dashboard when done testing.",
  type: "affiliate",
  commission_pct: 10,
  attribution_days: 30,
  status: "active",
  visibility: "public",
  deliverable_count: 1,
  niche: ["demo"],
}).select("id").single();
if (camp.error) { console.log("❌ campaign:", camp.error.message); process.exit(1); }

const link = await sb.from("tracking_links").insert({
  creator_id: creator.id,
  campaign_id: camp.data.id,
  slug: "demo" + Date.now().toString(36).slice(-6),
  destination_url: "https://adswish-lake.vercel.app",
}).select("id, slug, destination_url").single();
if (link.error) { console.log("❌ link:", link.error.message); process.exit(1); }

const redir = await fetch(`${BASE}/t/${link.data.slug}`, { redirect: "manual" });
console.log("\n✅ Demo tracking link created:");
console.log(`   ${BASE}/t/${link.data.slug}`);
console.log(`   redirect status: ${redir.status}`);
console.log(`   destination: ${link.data.destination_url}`);
console.log(`   campaign id: ${camp.data.id}`);
console.log(`\nOpen the link, then in the extension popup click "Send pixel heartbeat" and "Test conversion".`);
