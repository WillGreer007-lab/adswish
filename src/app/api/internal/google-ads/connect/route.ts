import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isGoogleAdsConfigured, buildGoogleAdsAuthUrl } from "@/lib/google-ads/oauth";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const origin = new URL(request.url).origin;
  const dest = `${origin}/dashboard/business/google-ads`;

  if (!isGoogleAdsConfigured()) {
    return NextResponse.redirect(`${dest}?error=google_ads_not_configured`);
  }

  const state = crypto.randomUUID();
  // GOOGLE_OAUTH_REDIRECT_URI is authoritative: it must EXACTLY match a URI
  // registered in the Google Cloud OAuth client. Fall back to the dynamic
  // origin (localhost dev) only when the env var is unset.
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI || `${origin}/api/internal/google-ads/callback`;
  const authUrl = buildGoogleAdsAuthUrl(state, redirectUri);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("google_ads_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
