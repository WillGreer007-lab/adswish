import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/internal/oauth/youtube?redirect_to=...
 * Starts the YouTube (Google) OAuth flow for subscriber verification.
 * `state` carries the user id so the callback can upsert the account
 * without trusting the caller's cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const redirectTo = searchParams.get("redirect_to") || "/onboarding/creator/connect_social";

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${origin}${redirectTo}?error=youtube_not_configured`,
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
    redirect_uri: `${origin}/api/internal/oauth/youtube/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    access_type: "offline",
    prompt: "consent",
    state: user.id,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
