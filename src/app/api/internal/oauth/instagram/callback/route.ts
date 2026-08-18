import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/onboarding/creator/connect_social?error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/onboarding/creator/connect_social?error=no_code`);
  }

  const userId = state;
  if (!userId) {
    return NextResponse.redirect(`${origin}/login?redirect=/onboarding`);
  }

  try {
    const tokenResponse = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_CLIENT_ID!,
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: `${origin}/api/internal/oauth/instagram/callback`,
        code,
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokens.access_token) {
      return NextResponse.redirect(`${origin}/onboarding/creator/connect_social?error=token_exchange_failed`);
    }

    const profileResponse = await fetch(
      `https://graph.instagram.com/me?fields=username,followers_count&access_token=${tokens.access_token}`,
    );

    const profile = await profileResponse.json();
    const handle = profile?.username || "unknown";
    const followerCount = profile?.followers_count || 0;

    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();

    await supabase.from("creator_social_accounts").upsert({
      creator_id: userId,
      platform: "instagram",
      handle,
      follower_count: followerCount,
      verified_at: new Date().toISOString(),
      access_token: tokens.access_token,
      refresh_token: null,
      token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      refresh_token_expires_at: null,
      disconnected_at: null,
    }, { onConflict: "creator_id,platform" });

    return NextResponse.redirect(`${origin}/onboarding/creator/connect_social?success=instagram`);
  } catch (err) {
    console.error("Instagram OAuth error:", err);
    return NextResponse.redirect(`${origin}/onboarding/creator/connect_social?error=oauth_failed`);
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
