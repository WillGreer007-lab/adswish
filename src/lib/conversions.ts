import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyTrackingJwt } from "@/lib/tracking";
import { calculateCreatorCut, calculatePlatformFee } from "@/lib/stripe/client";

export type AttributionMethod = "cookie" | "s2s" | "utm_fallback" | "manual";

export interface RecordConversionInput {
  token: string;
  orderId: string;
  amountDollars: number;
  currency?: string;
  attributionMethod?: AttributionMethod;
}

export interface RecordConversionResult {
  ok: boolean;
  status: 200 | 401 | 404 | 409 | 410 | 422;
  conversionId?: string;
  error?: string;
}

const HOLD_DAYS = 7;

/**
 * Verify an `adswish_ref` token and record the conversion as a 7-day hold with
 * the 90/10 split. Idempotent on `order_id` so retried webhooks (Stripe-style
 * backoff) don't double-count a sale.
 */
export async function recordConversion(
  input: RecordConversionInput,
  supabase: SupabaseClient,
): Promise<RecordConversionResult> {
  if (!input.token || !input.orderId || !Number.isFinite(input.amountDollars)) {
    return { ok: false, status: 422, error: "token, orderId and amount are required" };
  }
  if (input.amountDollars <= 0) {
    return { ok: false, status: 422, error: "amount must be positive" };
  }

  let claims;
  try {
    claims = await verifyTrackingJwt(input.token);
  } catch {
    return { ok: false, status: 401, error: "Invalid or expired tracking token" };
  }

  // Blocklist check: revoked jti -> 410 Gone (never attribute).
  const { data: revoked } = await supabase
    .from("revoked_jtis")
    .select("jti")
    .eq("jti", claims.jti)
    .maybeSingle();
  if (revoked) {
    return { ok: false, status: 410, error: "Tracking link revoked" };
  }

  // Link must still exist and be live.
  const { data: link } = await supabase
    .from("tracking_links")
    .select("id, revoked_at")
    .eq("id", claims.linkId)
    .maybeSingle();
  if (!link || link.revoked_at) {
    return { ok: false, status: 410, error: "Tracking link revoked" };
  }

  // Idempotency: one conversion per order_id.
  const { data: existing } = await supabase
    .from("conversions")
    .select("id")
    .eq("order_id", input.orderId)
    .maybeSingle();
  if (existing) {
    return { ok: true, status: 409, conversionId: existing.id };
  }

  const amount = Math.round(input.amountDollars * 100) / 100;
  const creatorCut = calculateCreatorCut(amount);
  const platformCut = calculatePlatformFee(amount);
  const holdExpiresAt = new Date(Date.now() + HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: conversion, error: insertError } = await supabase
    .from("conversions")
    .insert({
      tracking_link_id: claims.linkId,
      order_id: input.orderId,
      order_amount: amount,
      currency: input.currency || "USD",
      creator_cut: creatorCut,
      platform_cut: platformCut,
      status: "pending_hold",
      hold_expires_at: holdExpiresAt,
      attribution_method: input.attributionMethod || "s2s",
    })
    .select("id")
    .single();

  if (insertError || !conversion) {
    return { ok: false, status: 404, error: insertError?.message || "Failed to record conversion" };
  }

  // The creator's 90% enters hold immediately; it is released by the finance
  // jobs after the 7-day window (or held on refund/chargeback).
  await supabase.from("ledger_entries").insert({
    related_conversion_id: conversion.id,
    type: "hold",
    amount: creatorCut,
    currency: input.currency || "USD",
  });

  return { ok: true, status: 200, conversionId: conversion.id };
}
