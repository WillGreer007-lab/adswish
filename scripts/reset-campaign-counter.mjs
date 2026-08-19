#!/usr/bin/env node
// Reset the free-plan campaign counter on the test business profile.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const SUPABASE_URL = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim();
const SERVICE_KEY = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim();
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const email = process.argv[2] || "willgreer38@gmail.com";
let userId = null;
{
  const { data: user } = await sb.from("profiles").select("id").eq("email", email).maybeSingle();
  userId = user?.id ?? null;
}
if (!userId) {
  const { data: u } = await sb.auth.admin.listUsers();
  const hit = u?.users?.find((x) => x.email === email);
  userId = hit?.id;
}
if (!userId) { console.log("user not found:", email); process.exit(1); }

const thisMonth = new Date().toISOString().slice(0, 7);
const { data, error } = await sb.from("business_profiles").update({ campaigns_created_this_month: 0, campaigns_created_month: thisMonth }).eq("user_id", userId).select("user_id, campaigns_created_this_month, campaigns_created_month");
if (error) { console.log("ERR", error.message); process.exit(1); }
console.log("Reset for", email, "->", JSON.stringify(data));
