import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripeClient, getStripeCurrency } from "@/lib/stripe/client";

const PLAN_PRICES: Record<string, { name: string; amount: number }> = {
  creator_pro: { name: "Creator Pro", amount: 500 },
  creator_premium: { name: "Creator Premium", amount: 1000 },
  business_growth: { name: "Business Growth", amount: 700 },
  business_enterprise: { name: "Business Enterprise", amount: 1500 },
};

/**
 * POST /api/internal/stripe/subscribe  { plan_slug }
 * Creates a Stripe Checkout Session (mode: subscription) for a paid plan and
 * returns the hosted checkout URL. The checkout.session.completed webhook
 * persists the subscription row via syncSubscription().
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const planSlug = (body?.plan_slug as string | undefined) ?? "";
  const price = PLAN_PRICES[planSlug];
  if (!price) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const role = user.user_metadata?.role;
  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_APP_DOMAIN ||
    "http://localhost:3000";

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: getStripeCurrency(),
          product_data: { name: price.name },
          recurring: { interval: "month" },
          unit_amount: price.amount,
        },
        quantity: 1,
      },
    ],
    metadata: { user_id: user.id, role, plan_slug: planSlug },
    subscription_data: {
      metadata: { user_id: user.id, role, plan_slug: planSlug },
    },
    success_url: `${origin}/onboarding/${role}/plan_selection?checkout=success`,
    cancel_url: `${origin}/onboarding/${role}/plan_selection?checkout=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
