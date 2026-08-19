#!/usr/bin/env node
// List recent campaigns + count for the test business to diagnose free-plan limit.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const SUPABASE_URL = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim();
const SERVICE_KEY = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim();
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const { data, error } = await sb.from("campaigns").select("id, title, status, created_at").order("created_at", { ascending: false }).limit(15);
if (error) { console.log("ERR", error.message); process.exit(1); }
console.log(`Total campaigns: ${data.length}`);
data.forEach((c) => console.log(c.id, "|", c.title, "|", c.status, "|", c.created_at));
