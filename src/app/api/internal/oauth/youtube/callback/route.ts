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
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${origin}/api/internal/oauth/youtube/callback`,
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokens.access_token) {
      return NextResponse.redirect(`${origin}/onboarding/creator/connect_social?error=token_exchange_failed`);
    }

    const channelResponse = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&mine=true",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );

    const channelData = await channelResponse.json();
    const channel = channelData?.items?.[0];
    const handle = channel?.snippet?.customUrl || channel?.snippet?.title || "unknown";
    const followerCount = parseInt(channel?.statistics?.subscriberCount || "0", 10);

    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();

    await supabase.from("creator_social_accounts").upsert({
      creator_id: userId,
      platform: "youtube",
      handle,
      follower_count: followerCount,
      verified_at: new Date().toISOString(),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      refresh_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      disconnected_at: null,
    }, { onConflict: "creator_id,platform" });

    try {
      const { refreshCreatorBadges } = await import("@/lib/badges");
      await refreshCreatorBadges(userId);
    } catch {
      /* the daily badges cron reconciles drift */
    }

    return NextResponse.redirect(`${origin}/onboarding/creator/connect_social?success=youtube`);
  } catch (err) {
    console.error("YouTube OAuth error:", err);
    return NextResponse.redirect(`${origin}/onboarding/creator/connect_social?error=oauth_failed`);
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
