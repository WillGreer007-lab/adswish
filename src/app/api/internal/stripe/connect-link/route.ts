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

  const role = user.user_metadata?.role;
  if (role !== "creator" && role !== "business") {
    return NextResponse.json({ error: "Invalid role for Connect" }, { status: 403 });
  }

  const table = role === "business" ? "business_profiles" : "creator_profiles";
  const nameCol = role === "business" ? "company_name" : "display_name";

  // Reuse the account if one was already created.
  const { data: profile } = await supabase
    .from(table)
    .select(`stripe_account_id, ${nameCol}`)
    .eq("user_id", user.id)
    .single();

  let accountId: string | null = profile?.stripe_account_id ?? null;

  if (!accountId) {
    accountId = await createCreatorConnectAccount({
      userId: user.id,
      email: user.email || "",
      name: (profile as any)?.[nameCol] || user.user_metadata?.display_name,
    });

    await supabase
      .from(table)
      .update({ stripe_account_id: accountId })
      .eq("user_id", user.id);
  }

  const stripe = getStripeClient();
  const origin = request.headers.get("origin") || "http://localhost:3000";
  const returnPath = role === "business" ? "/dashboard/business/payments" : "/onboarding/creator/stripe_setup";

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}${returnPath}`,
    return_url: `${origin}/auth/callback?next=${encodeURIComponent(returnPath)}`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
