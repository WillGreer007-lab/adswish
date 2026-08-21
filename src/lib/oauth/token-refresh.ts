import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import pino from "pino";

const logger = pino({ name: "token-refresh" });

interface SocialAccount {
  id: string;
  creator_id: string;
  platform: "tiktok" | "instagram" | "youtube" | "twitter";
  handle: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  disconnected_at: string | null;
}

export async function refreshExpiredTokens() {
  const supabase = createSupabaseServiceRoleClient();

  const now = new Date().toISOString();
  const soon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: accounts, error } = await supabase
    .from("creator_social_accounts")
    .select("*")
    .not("refresh_token", "is", null)
    .is("disconnected_at", null)
    .lt("token_expires_at", soon);

  if (error) {
    logger.error({ error: error.message }, "Failed to fetch accounts for token refresh");
    return;
  }

  if (!accounts || accounts.length === 0) {
    logger.info("No tokens need refreshing");
    return;
  }

  for (const account of accounts as SocialAccount[]) {
    try {
      let tokens: { access_token: string; refresh_token?: string; expires_in?: number };

      switch (account.platform) {
        case "tiktok":
          tokens = await refreshTikTokToken(account.refresh_token!);
          break;
        case "youtube":
          tokens = await refreshYouTubeToken(account.refresh_token!);
          break;
        case "instagram":
          tokens = await refreshInstagramToken(account.refresh_token!);
          break;
        default:
          continue;
      }

      await supabase
        .from("creator_social_accounts")
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || account.refresh_token,
          token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
          disconnected_at: null,
        })
        .eq("id", account.id);

      logger.info({ creator_id: account.creator_id, platform: account.platform }, "Token refreshed");
    } catch (err) {
      logger.error(
        { creator_id: account.creator_id, platform: account.platform, error: err },
        "Token refresh failed",
      );

      await handleRefreshFailure(supabase, account);
    }
  }
}

async function handleRefreshFailure(supabase: ReturnType<typeof createSupabaseServiceRoleClient>, account: SocialAccount) {
  const { data: existing } = await supabase
    .from("failed_jobs")
    .select("attempt_count")
    .eq("job_type", `token_refresh_${account.id}`)
    .single();

  const attemptCount = (existing?.attempt_count || 0) + 1;

  await supabase.from("failed_jobs").upsert({
    job_type: `token_refresh_${account.id}`,
    payload: { creator_id: account.creator_id, platform: account.platform },
    error_message: "Token refresh failed",
    attempt_count: attemptCount,
    last_attempted_at: new Date().toISOString(),
  }, { onConflict: "job_type" });

  if (attemptCount >= 3) {
    await supabase
      .from("creator_social_accounts")
      .update({ disconnected_at: new Date().toISOString() })
      .eq("id", account.id);

    await supabase.from("notifications").insert({
      user_id: account.creator_id,
      type: "system",
      body: `Your ${account.platform} account has been disconnected. Reconnect to continue applying to campaigns.`,
      link: "/onboarding/creator/connect_social",
    });

    logger.warn(
      { creator_id: account.creator_id, platform: account.platform },
      "Social account marked as disconnected after 3 failed refresh attempts",
    );
  }
}

async function refreshTikTokToken(refreshToken: string) {
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) throw new Error(`TikTok refresh failed: ${response.status}`);

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

async function refreshYouTubeToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) throw new Error(`YouTube refresh failed: ${response.status}`);

  const data = await response.json();
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
  };
}

async function refreshInstagramToken(refreshToken: string) {
  const response = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${refreshToken}`,
    { method: "GET" },
  );

  if (!response.ok) throw new Error(`Instagram refresh failed: ${response.status}`);

  const data = await response.json();
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
  };
}
