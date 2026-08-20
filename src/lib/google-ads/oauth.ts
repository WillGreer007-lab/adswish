/**
 * Google OAuth helpers for the Adswish ↔ Google Ads integration (Phase 2).
 *
 * No third-party Google SDK is used — these are plain HTTPS calls to Google's
 * documented OAuth2 endpoints, so the pinned dependency set stays untouched.
 *
 * Required environment variables (owner-provided, never committed):
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GOOGLE_OAUTH_REDIRECT_URI   (must exactly match the Google Cloud console)
 *   GOOGLE_ADS_DEVELOPER_TOKEN  (used only by the Ads API client, not OAuth)
 */

export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function googleAdsOAuthConfig() {
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "",
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
  };
}

/** True when the OAuth client is configured well enough to start a connect. */
export function isGoogleAdsConfigured(): boolean {
  const c = googleAdsOAuthConfig();
  return Boolean(c.clientId && c.clientSecret && c.redirectUri);
}

/** Build the Google OAuth consent URL. `access_type=offline` requests a refresh token. */
export function buildGoogleAdsAuthUrl(state: string, redirectUri?: string): string {
  const c = googleAdsOAuthConfig();
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: redirectUri ?? c.redirectUri,
    response_type: "code",
    scope: GOOGLE_ADS_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
};

/** Exchange an authorization code for access + refresh tokens. */
export async function exchangeGoogleAdsCode(code: string, redirectUri?: string): Promise<GoogleTokenResponse> {
  const c = googleAdsOAuthConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.clientId,
      client_secret: c.clientSecret,
      redirect_uri: redirectUri ?? c.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }

  return (await res.json()) as GoogleTokenResponse;
}

/** Refresh an expiring access token using the stored refresh token. */
export async function refreshGoogleAdsAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const c = googleAdsOAuthConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token refresh failed (${res.status})`);
  }

  return (await res.json()) as GoogleTokenResponse;
}
