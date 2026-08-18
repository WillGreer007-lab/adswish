import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";

/**
 * Refresh a creator's Stripe Connect readiness directly from the Stripe API.
 *
 * This is the no-CLI path: after the creator finishes Stripe's hosted
 * onboarding and returns to the app, the stripe_setup page calls this route,
 * which reads the account state from Stripe and flips `stripe_connect_ready`
 * without needing a live webhook delivery (which localhost can't receive).
 * The `account.updated` webhook remains the production fast-path.
 */
export async function POST() {
  const { createServerClient } = await import("@supabase/ssr");
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.user_metadata?.role !== "creator") {
    return NextResponse.json({ error: "Only creators need Connect" }, { status: 403 });
  }

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("stripe_account_id")
    .eq("user_id", user.id)
    .single();

  const accountId = profile?.stripe_account_id ?? null;
  if (!accountId) {
    return NextResponse.json({ ready: false, reason: "no_account" });
  }

  try {
    const stripe = getStripeClient();
    const account = await stripe.accounts.retrieve(accountId);
    const ready = account.charges_enabled === true && account.details_submitted === true;

    await supabase
      .from("creator_profiles")
      .update({ stripe_account_id: account.id, stripe_connect_ready: ready })
      .eq("user_id", user.id);

    return NextResponse.json({
      ready,
      charges_enabled: account.charges_enabled === true,
      details_submitted: account.details_submitted === true,
    });
  } catch {
    return NextResponse.json({ ready: false, reason: "account_lookup_failed" });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
