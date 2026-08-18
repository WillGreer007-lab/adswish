import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/internal/oauth/tiktok?redirect_to=...
 * Starts the TikTok OAuth flow: verifies the caller is signed in, then
 * redirects to TikTok's authorization page. `state` carries the user id so
 * the callback can upsert the account without trusting the caller's cookie
 * (the callback runs as a service-role write).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const redirectTo = searchParams.get("redirect_to") || "/onboarding/creator/connect_social";

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    return NextResponse.redirect(
      `${origin}${redirectTo}?error=tiktok_not_configured`,
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
    client_key: clientKey,
    response_type: "code",
    scope: "user.info.basic",
    redirect_uri: `${origin}/api/internal/oauth/tiktok/callback`,
    state: user.id,
  });

  return NextResponse.redirect(
    `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`,
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
