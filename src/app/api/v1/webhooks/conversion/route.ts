import { type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recordConversion, type AttributionMethod } from "@/lib/conversions";
import { createDestinationChargeForConversion } from "@/lib/finance";
import { checkRateLimit } from "@/lib/redis";
import { sha256Hex } from "@/lib/tracking";
import { corsJson, corsOptions } from "@/lib/cors";

/**
 * S2S conversion webhook (blueprint §11). The business's backend POSTs the
 * stored `adswish_ref` token (or the pixel posts the cookie token) so
 * attribution survives even when the cookie is blocked by consent management.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  const token = body?.token ?? body?.adswish_ref;
  const orderId = body?.orderId ?? body?.order_id;
  const amount = body?.amount ?? body?.order_amount;
  const attributionMethod = (body?.attribution_method ?? body?.attributionMethod ?? "s2s") as AttributionMethod;

  if (!token || !orderId || typeof amount !== "number") {
    return corsJson({ error: "token, orderId and amount are required" }, 422);
  }

  // Public webhook: cap abuse per IP (60/min is generous for S2S batches).
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = await sha256Hex(ip);
  const rl = await checkRateLimit({
    key: `conversion:${ipHash}`,
    limit: 60,
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

  const result = await recordConversion(
    { token, orderId: String(orderId), amountDollars: amount, attributionMethod },
    supabase,
  );

  if (!result.ok) {
    return corsJson({ error: result.error }, result.status);
  }

  // Charge the business's stored payment method now (destination charge).
  // Idempotent (skips if already charged) and best-effort: a missing payment
  // method or a declined charge leaves the conversion in pending_hold rather
  // than failing the attribution webhook.
  if (result.conversionId) {
    await createDestinationChargeForConversion(result.conversionId).catch(() => {});
  }

  return corsJson(
    { success: true, conversion_id: result.conversionId },
    result.status === 409 ? 200 : result.status,
  );
}

export async function OPTIONS() {
  return corsOptions();
}
