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
    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${origin}/api/internal/oauth/tiktok/callback`,
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokens.access_token) {
      return NextResponse.redirect(`${origin}/onboarding/creator/connect_social?error=token_exchange_failed`);
    }

    const userInfoResponse = await fetch("https://open.tiktokapis.com/v2/user/info/", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const userInfo = await userInfoResponse.json();
    const handle = userInfo?.data?.user?.username || "unknown";
    const followerCount = userInfo?.data?.user?.follower_count || 0;

    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceRoleClient();

    await supabase.from("creator_social_accounts").upsert({
      creator_id: userId,
      platform: "tiktok",
      handle,
      follower_count: followerCount,
      verified_at: new Date().toISOString(),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + (tokens.expires_in || 86400) * 1000).toISOString(),
      refresh_token_expires_at: new Date(Date.now() + (tokens.refresh_expires_in || 2592000) * 1000).toISOString(),
      disconnected_at: null,
    }, { onConflict: "creator_id,platform" });

    return NextResponse.redirect(`${origin}/onboarding/creator/connect_social?success=tiktok`);
  } catch (err) {
    console.error("TikTok OAuth error:", err);
    return NextResponse.redirect(`${origin}/onboarding/creator/connect_social?error=oauth_failed`);
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
