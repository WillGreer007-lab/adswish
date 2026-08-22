import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchYouTubeSubscriberCount } from "@/lib/youtube";

/**
 * Follower re-check (blueprint: pg_cron monthly, "1st of each month 00:00").
 * Re-fetches each connected social account's live follower count, stamps it on
 * `creator_social_accounts`, recomputes the creator's tier from the highest
 * connected account, and refreshes badges.
 *
 * Graceful by design: a platform whose API keys aren't configured (TikTok /
 * Instagram keys are currently empty) is skipped and reported, never treated as
 * an error — so the job is safe to run before those keys exist.
 */

export type RecheckPlatform = "tiktok" | "instagram" | "youtube" | "twitter";

export const TIER_THRESHOLDS = {
  /** below this = no tier */
  minMicro: 10_000,
  minMid: 100_000,
  minMacro: 1_000_000,
} as const;

export function tierForFollowers(count: number): "micro" | "mid" | "macro" | null {
  if (count < TIER_THRESHOLDS.minMicro) return null;
  if (count < TIER_THRESHOLDS.minMid) return "micro";
  if (count < TIER_THRESHOLDS.minMacro) return "mid";
  return "macro";
}

interface SocialAccount {
  id: string;
  creator_id: string;
  platform: RecheckPlatform;
  handle: string;
  access_token: string | null;
  refresh_token: string | null;
  follower_count: number;
}

/** Fetch a platform's live follower count for one account (or null if skipped). */
async function fetchLiveCount(
  platform: RecheckPlatform,
  accessToken: string | null,
  handle: string,
): Promise<number | null> {
  switch (platform) {
    case "tiktok": {
      const key = process.env.TIKTOK_CLIENT_KEY;
      if (!key || !accessToken) return null; // not configured / no token — skip
      const res = await fetch("https://open.tiktokapis.com/v2/user/info/", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`TikTok ${res.status}`);
      const j = await res.json();
      return Number(j?.data?.user?.follower_count ?? 0);
    }
    case "instagram": {
      const key = process.env.INSTAGRAM_CLIENT_ID;
      if (!key || !accessToken) return null; // not configured / no token — skip
      const res = await fetch(
        `https://graph.instagram.com/me?fields=username,followers_count&access_token=${accessToken}`,
      );
      if (!res.ok) throw new Error(`Instagram ${res.status}`);
      const j = await res.json();
      return Number(j?.followers_count ?? 0);
    }
    case "youtube":
      // No OAuth needed: resolve the public channel by handle with an API key.
      return await fetchYouTubeSubscriberCount(handle);
    case "twitter":
      // Twitter/X has no privileged API in this system — its count is set at
      // admin approval time (token-in-bio + screenshot), so skip the live re-check.
      return null;
  }
}

export interface RecheckResult {
  accounts: number;
  updated: number;
  skipped: number;
  failed: number;
  tiersChanged: number;
}

/**
 * The monthly cron job. Iterates connected, non-disconnected social accounts,
 * refreshes their counts, then recomputes the owner's tier + badges.
 */
export async function recheckFollowerCounts(): Promise<RecheckResult> {
  const supabase = createSupabaseServiceRoleClient();
  const result: RecheckResult = {
    accounts: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    tiersChanged: 0,
  };

  const { data: accounts } = await supabase
    .from("creator_social_accounts")
    .select("id, creator_id, platform, handle, access_token, refresh_token, follower_count")
    .is("disconnected_at", null);

  for (const account of (accounts ?? []) as SocialAccount[]) {
    result.accounts += 1;
    try {
      const live = await fetchLiveCount(account.platform, account.access_token, account.handle);
      if (live === null) {
        result.skipped += 1;
        continue;
      }

      await supabase
        .from("creator_social_accounts")
        .update({ follower_count: live, verified_at: new Date().toISOString() })
        .eq("id", account.id);
      result.updated += 1;

      const tierChanged = await recomputeCreatorTier(supabase, account.creator_id);
      if (tierChanged) result.tiersChanged += 1;

      try {
        const { refreshCreatorBadges } = await import("@/lib/badges");
        await refreshCreatorBadges(account.creator_id);
      } catch {
        /* badges cron reconciles drift */
      }
    } catch {
      result.failed += 1;
      // Log to the failed-jobs table for visibility without aborting the sweep.
      await supabase.from("failed_jobs").upsert(
        {
          job_type: `follower_recheck_${account.id}`,
          payload: { creator_id: account.creator_id, platform: account.platform },
          error_message: `Follower re-check failed for ${account.platform}`,
          attempt_count: 1,
          last_attempted_at: new Date().toISOString(),
        },
        { onConflict: "job_type" },
      );
    }
  }

  return result;
}

/** Recompute + persist a creator's tier from their highest connected count. */
async function recomputeCreatorTier(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  creatorId: string,
): Promise<boolean> {
  const { data: socials } = await supabase
    .from("creator_social_accounts")
    .select("follower_count")
    .eq("creator_id", creatorId)
    .is("disconnected_at", null);

  const max = Math.max(
    0,
    ...(socials ?? []).map((s: { follower_count: number | null }) => Number(s.follower_count) || 0),
  );
  const nextTier = tierForFollowers(max) ?? "micro";

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("tier")
    .eq("user_id", creatorId)
    .maybeSingle();

  if (profile && profile.tier === nextTier) return false;

  await supabase
    .from("creator_profiles")
    .update({
      tier: nextTier,
      previous_tier: profile?.tier ?? null,
      tier_changed_at: new Date().toISOString(),
    })
    .eq("user_id", creatorId);

  // Blocking future applications happens at application time (the applications
  // route already re-reads live follower counts), so a tier drop only affects
  // NEW applications, never campaigns already in progress — per blueprint.
  return true;
}
