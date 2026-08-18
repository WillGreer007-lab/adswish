import { NextResponse, NextRequest } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";

export async function POST(request: NextRequest) {
  const { createServerClient } = await import("@supabase/ssr");
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    }},
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = user.user_metadata?.role;
  if (role !== "business") {
    return NextResponse.json({ error: "Only businesses need payment setup" }, { status: 403 });
  }

  const stripe = getStripeClient();
  const origin = request.headers.get("origin") || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    metadata: {
      user_id: user.id,
      email: user.email || "",
      role: "business",
    },
    success_url: `${origin}/auth/callback?next=/onboarding/business/stripe_setup`,
    cancel_url: `${origin}/onboarding/business/stripe_setup`,
  });

  return NextResponse.json({ url: session.url });
}
