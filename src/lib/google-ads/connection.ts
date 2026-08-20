import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { refreshGoogleAdsAccessToken } from "@/lib/google-ads/oauth";

export type GoogleAdsConnection = {
  user_id: string;
  google_customer_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  scopes: string[] | null;
  status: "active" | "disconnected";
};

export async function getConnection(userId: string): Promise<GoogleAdsConnection | null> {
  const sb = createSupabaseServiceRoleClient();
  const { data } = await sb
    .from("google_ads_connections")
    .select("user_id, google_customer_id, access_token, refresh_token, expires_at, scopes, status")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as GoogleAdsConnection | null) ?? null;
}

export async function upsertConnection(
  userId: string,
  input: { accessToken: string; refreshToken: string | null; expiresAt: string; scopes: string[] },
): Promise<void> {
  const sb = createSupabaseServiceRoleClient();
  await sb.from("google_ads_connections").upsert(
    {
      user_id: userId,
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      expires_at: input.expiresAt,
      scopes: input.scopes,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

export async function setCustomerId(userId: string, customerId: string): Promise<void> {
  const sb = createSupabaseServiceRoleClient();
  await sb
    .from("google_ads_connections")
    .update({ google_customer_id: customerId, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

export async function deleteConnection(userId: string): Promise<void> {
  const sb = createSupabaseServiceRoleClient();
  await sb.from("google_ads_connections").delete().eq("user_id", userId);
}

/**
 * Return a non-expired access token for the user, refreshing it first if the
 * stored one is within 60s of expiry. Returns null when not connected.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const conn = await getConnection(userId);
  if (!conn || conn.status !== "active") return null;

  const hasFresh = conn.access_token && conn.expires_at && new Date(conn.expires_at).getTime() > Date.now() + 60_000;
  if (hasFresh) return conn.access_token;

  if (!conn.refresh_token) return null;

  const fresh = await refreshGoogleAdsAccessToken(conn.refresh_token);
  const expiresAt = new Date(Date.now() + (fresh.expires_in ?? 3600) * 1000).toISOString();
  await upsertConnection(userId, {
    accessToken: fresh.access_token,
    refreshToken: fresh.refresh_token ?? conn.refresh_token,
    expiresAt,
    scopes: fresh.scope ? fresh.scope.split(" ") : conn.scopes ?? [],
  });
  return fresh.access_token;
}
