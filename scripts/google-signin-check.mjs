#!/usr/bin/env node
/**
 * Verify the Google sign-in flow on production:
 *  1. Call Supabase signInWithOAuth(google) exactly like the login page does.
 *  2. Follow the returned URL to the Supabase authorize endpoint.
 *  3. Assert it redirects to Google with the correct client_id + redirect_uri.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const SUPABASE_URL = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim();
const ANON_KEY = env.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)[1].trim();

const sb = createClient(SUPABASE_URL, ANON_KEY);
const { data, error } = await sb.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: "https://adswish-lake.vercel.app/auth/callback" },
});
if (error) { console.log("❌ signInWithOAuth failed:", error.message); process.exit(1); }
console.log("✅ signInWithOAuth returned URL:", (data.url || "").slice(0, 90) + "…");

// The URL points at Supabase's auth endpoint; follow it (manual) to see the
// actual Google redirect it produces.
const res = await fetch(data.url, { redirect: "manual" });
console.log("status after Supabase hop:", res.status);
const loc = res.headers.get("location") || "";
if (!loc.includes("accounts.google.com")) {
  console.log("❌ did not reach Google:", loc.slice(0, 140));
  process.exit(1);
}
const url = new URL(loc);
const clientId = url.searchParams.get("client_id") || "";
const redirectUri = url.searchParams.get("redirect_uri") || "";
const scope = url.searchParams.get("scope") || "";
console.log("✅ reaches accounts.google.com");
console.log("   client_id:", clientId.slice(0, 24) + "…");
console.log("   redirect_uri:", redirectUri);
console.log("   scope:", scope.slice(0, 80));

const ok =
  clientId.startsWith("709354748675-") &&
  redirectUri === "https://kzydyzugcyiuheltfxko.supabase.co/auth/v1/callback";
console.log(ok ? "\n✅ Google OAuth configured correctly (client ID + redirect URI exact)" : "\n❌ param mismatch — check values above");
process.exit(ok ? 0 : 1);
