#!/usr/bin/env node
/**
 * Audit the production tracking-link state: every tracking link with its
 * destination + campaign status, so a broken link can be diagnosed in seconds.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const SUPABASE_URL = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim();
const SERVICE_KEY = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim();
const BASE = "https://adswish-lake.vercel.app";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const { data: links, error } = await sb
  .from("tracking_links")
  .select("id, slug, destination_url, revoked_at, campaign_id, created_at")
  .order("created_at", { ascending: false })
  .limit(25);

if (error) { console.log("ERR:", error.message); process.exit(1); }
if (!links?.length) { console.log("No tracking links exist in production."); process.exit(0); }

for (const l of links) {
  const { data: camp } = await sb
    .from("campaigns")
    .select("title, type, status, pause_mode")
    .eq("id", l.campaign_id)
    .maybeSingle();
  let http = "?";
  if (!l.revoked_at && camp) {
    try {
      const res = await fetch(BASE + "/t/" + l.slug, { redirect: "manual" });
      http = `${res.status}${res.status === 302 ? " → redirects" : ""}`;
    } catch { http = "fetch error"; }
  } else {
    http = l.revoked_at ? "410 (revoked)" : "410 (no campaign)";
  }
  console.log(`\n/t/${l.slug}`);
  console.log(`  → ${l.destination_url}`);
  console.log(`  campaign: ${camp?.title ?? "?"} (${camp?.type ?? "?"}, status=${camp?.status ?? "?"}${camp?.pause_mode ? ", pause=" + camp.pause_mode : ""})`);
  console.log(`  HTTP: ${http}${l.revoked_at ? " | REVOKED" : ""}`);
}
