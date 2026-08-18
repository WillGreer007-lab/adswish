import { NextResponse, NextRequest } from "next/server";
import { getStripeClient, createCreatorConnectAccount } from "@/lib/stripe/client";

export async function POST(request: NextRequest) {
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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.user_metadata?.role !== "creator") {
    return NextResponse.json({ error: "Only creators need Connect" }, { status: 403 });
  }

  // Reuse the creator's existing account if one was already created.
  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("stripe_account_id, display_name")
    .eq("user_id", user.id)
    .single();

  let accountId: string | null = profile?.stripe_account_id ?? null;

  if (!accountId) {
    accountId = await createCreatorConnectAccount({
      userId: user.id,
      email: user.email || "",
      name: profile?.display_name || user.user_metadata?.display_name,
    });

    // Persist immediately so onboarding can resume later.
    await supabase
      .from("creator_profiles")
      .update({ stripe_account_id: accountId })
      .eq("user_id", user.id);
  }

  const stripe = getStripeClient();
  const origin = request.headers.get("origin") || "http://localhost:3000";

  // v1 account_links accepts both v1 and v2 account ids (verified live), so
  // hosted onboarding stays on the typed SDK for both account versions.
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/onboarding/creator/stripe_setup`,
    return_url: `${origin}/auth/callback?next=/onboarding/creator/stripe_setup`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
