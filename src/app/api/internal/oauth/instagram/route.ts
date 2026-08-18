import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/internal/oauth/instagram?redirect_to=...
 * Starts the Instagram OAuth flow: verifies the caller is signed in, then
 * redirects to Instagram's authorization page. `state` carries the user id so
 * the callback can upsert the account without trusting the caller's cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const redirectTo = searchParams.get("redirect_to") || "/onboarding/creator/connect_social";

  const clientId = process.env.INSTAGRAM_CLIENT_ID;
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${origin}${redirectTo}?error=instagram_not_configured`,
    );
  }

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      `${origin}/login?redirect=${encodeURIComponent("/onboarding/creator/connect_social")}`,
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/internal/oauth/instagram/callback`,
    response_type: "code",
    scope: "user_profile,user_media",
    state: user.id,
  });

  return NextResponse.redirect(
    `https://api.instagram.com/oauth/authorize?${params.toString()}`,
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
