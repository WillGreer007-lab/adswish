import { type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/redis";
import { corsJson, corsOptions } from "@/lib/cors";

/**
 * Pixel heartbeat (blueprint §11). Fired continuously by `pixel.js` while a
 * visitor is on the business's site. Marks the business's Affiliate/Hybrid
 * campaigns `pixel_status = 'active'` and stamps `last_pixel_ping_at`.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const businessId = body?.business_id;

  if (!businessId || typeof businessId !== "string") {
    return corsJson({ error: "business_id is required" }, 422);
  }

  // Blueprint: 1 ping per 5 seconds per domain (limit 12/60s ≈ same cadence).
  const rl = await checkRateLimit({
    key: `pixel-ping:${businessId}`,
    limit: 12,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return corsJson({ error: "Too many requests" }, 429);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const now = new Date().toISOString();
  // A fresh ping restores the pixel; clear the offline marker (the 30-day
  // offline badge is computed from pixel_offline_at at read time elsewhere).
  const { error } = await supabase
    .from("campaigns")
    .update({ pixel_status: "active", last_pixel_ping_at: now, pixel_offline_at: null })
    .eq("business_id", businessId)
    .in("type", ["affiliate", "hybrid"])
    .eq("status", "active")
    .is("deleted_at", null);

  if (error) {
    return corsJson({ error: error.message }, 500);
  }

  return corsJson({ ok: true }, 200);
}

export async function OPTIONS() {
  return corsOptions();
}
