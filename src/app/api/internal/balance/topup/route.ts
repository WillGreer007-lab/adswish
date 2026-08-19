import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripeClient, getStripeCurrency } from "@/lib/stripe/client";

/**
 * POST /api/internal/balance/topup  { amount_cents }
 * Opens a Stripe Checkout (one-time payment) that credits the business balance
 * via the checkout.session.completed webhook (metadata.kind = "topup").
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.user_metadata?.role !== "business") {
    return NextResponse.json({ error: "Business account required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const amountCents = Number(body?.amount_cents);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "Invalid amount_cents" }, { status: 400 });
  }

  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_APP_DOMAIN ||
    "http://localhost:3000";

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: getStripeCurrency(),
          product_data: { name: "Adswish balance top-up" },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: { user_id: user.id, kind: "topup" },
    success_url: `${origin}/dashboard/business/payments?topup=success`,
    cancel_url: `${origin}/dashboard/business/payments?topup=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
