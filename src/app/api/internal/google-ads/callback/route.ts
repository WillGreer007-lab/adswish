import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { exchangeGoogleAdsCode } from "@/lib/google-ads/oauth";
import { upsertConnection } from "@/lib/google-ads/connection";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const origin = new URL(request.url).origin;
  const dest = `${origin}/dashboard/business/google-ads`;

  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get("google_ads_oauth_state")?.value;

  if (oauthError) {
    return NextResponse.redirect(`${dest}?error=${encodeURIComponent(oauthError.replace(/_/g, " "))}`);
  }

  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(`${dest}?error=${encodeURIComponent("Google sign-in was cancelled or timed out")}`);
  }

  try {
    // Must match the URI used to initiate the flow (connect route).
    const redirectUri =
      process.env.GOOGLE_OAUTH_REDIRECT_URI || `${origin}/api/internal/google-ads/callback`;
    const tokens = await exchangeGoogleAdsCode(code, redirectUri);
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
    await upsertConnection(user.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt,
      scopes: tokens.scope ? tokens.scope.split(" ") : [],
    });

    const res = NextResponse.redirect(`${dest}?connected=1`);
    res.cookies.delete("google_ads_oauth_state");
    return res;
  } catch {
    return NextResponse.redirect(`${dest}?error=${encodeURIComponent("Could not complete Google sign-in")}`);
  }
}
