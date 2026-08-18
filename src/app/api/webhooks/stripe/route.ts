import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { verifyStripeWebhookSignature } from "@/lib/stripe/client";
import { handleStripeEvent } from "@/lib/stripe-webhooks";
import { recordWebhookEvent, recordWebhookFailure } from "@/lib/finance";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = verifyStripeWebhookSignature(body, signature);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const payload = event as unknown as Record<string, unknown>;

  // Idempotency: the same event may be delivered more than once.
  try {
    const isNew = await recordWebhookEvent(event.id, "stripe", payload);
    if (!isNew) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch (err) {
    await recordWebhookFailure(event.id, "stripe", payload, String(err));
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }

  try {
    await handleStripeEvent(event, createSupabaseServiceRoleClient());
  } catch (err) {
    const attempts = await recordWebhookFailure(event.id, "stripe", payload, String(err));
    // After 5 failures we stop asking Stripe to retry and rely on the DLQ.
    if (attempts >= 5) {
      return NextResponse.json({ received: true, dead_lettered: true });
    }
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
