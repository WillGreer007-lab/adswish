import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  const stagingSecret = process.env.STRIPE_WEBHOOK_SECRET_STAGING;
  if (!stagingSecret) {
    console.error("STRIPE_WEBHOOK_SECRET_STAGING not set");
    return NextResponse.json(
      { error: "Staging webhook not configured" },
      { status: 500 },
    );
  }

  const stripe = (await import("@/lib/stripe/client")).getStripeClient();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, stagingSecret);
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid staging signature" },
      { status: 400 },
    );
  }

  const { type } = event;

  switch (type) {
    case "account.updated": {
      break;
    }
    case "invoice.payment_failed": {
      break;
    }
    case "invoice.payment_succeeded": {
      break;
    }
    case "charge.refunded": {
      break;
    }
    default: {
    }
  }

  return NextResponse.json({ received: true, environment: "staging" });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
