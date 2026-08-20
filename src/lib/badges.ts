import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * v3 verification badges (spec §24):
 * - Blue (verified_badge): active PAID plan (Pro or Premium) AND at least one
 *   verified social account (OAuth-connected or approved manual screenshot).
 * - Gold (gold_badge): PREMIUM plan AND at least one verified social AND
 *   >= 1M followers on at least one of them.
 * (Identity / ID-upload verification is not wired yet — the admin flow that
 *  stamps it is a separate feature.)
 */

export const PAID_CREATOR_PLANS = ["creator_pro", "creator_premium"] as const;
export const GOLD_FOLLOWER_THRESHOLD = 1_000_000;
export const PAID_BUSINESS_PLANS = ["business_growth", "business_enterprise"] as const;

/**
 * Recompute + persist one creator's badges. Called whenever a signal changes:
 * subscription upsert, manual-verification approval, social connect, and the
 * daily badges cron (which catches any drift).
 */
export async function refreshCreatorBadges(creatorId: string): Promise<void> {
  const supabase = createSupabaseServiceRoleClient();

  const [{ data: sub }, { data: socials }, { data: manual }] = await Promise.all([
    supabase
      .from("creator_subscriptions")
      .select("plan_slug")
      .eq("creator_id", creatorId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("creator_social_accounts")
      .select("follower_count")
      .eq("creator_id", creatorId)
      .not("verified_at", "is", null),
    supabase
      .from("manual_follower_verifications")
      .select("claimed_follower_count")
      .eq("creator_id", creatorId)
      .eq("status", "approved"),
  ]);

  const paid = Boolean(
    sub &&
      (PAID_CREATOR_PLANS as readonly string[]).includes(sub.plan_slug),
  );

  // Blue badge requires at least one VERIFIED social (OAuth or manual
  // screenshot) — an empty profile can't be marketplace-verified.
  const hasVerifiedSocial = (socials?.length ?? 0) > 0 || (manual?.length ?? 0) > 0;

  const maxFollowers = Math.max(
    0,
    ...(socials ?? []).map((s: { follower_count: number | null }) => Number(s.follower_count) || 0),
    ...(manual ?? []).map((m: { claimed_follower_count: number | null }) => Number(m.claimed_follower_count) || 0),
  );

  const verifiedBadge = paid && hasVerifiedSocial;
  const goldBadge =
    sub?.plan_slug === "creator_premium" &&
    hasVerifiedSocial &&
    maxFollowers >= GOLD_FOLLOWER_THRESHOLD;

  await supabase
    .from("creator_profiles")
    .update({ verified_badge: verifiedBadge, gold_badge: goldBadge })
    .eq("user_id", creatorId);
}

/** Job: recompute badges for every creator. Used by the daily cron. */
export async function refreshAllCreatorBadges(): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: creators } = await supabase
    .from("creator_profiles")
    .select("user_id")
    .is("deleted_at", null);

  for (const creator of creators ?? []) {
    try {
      await refreshCreatorBadges(creator.user_id);
    } catch {
      /* keep going — a single failure shouldn't abort the sweep */
    }
  }
  return creators?.length ?? 0;
}

/**
 * Business-side badges (spec §22 mirrored):
 * - Blue (verified_badge): active PAID plan (Growth/Enterprise) AND a verified
 *   tracking domain (the business equivalent of a verified channel).
 * - Gold (gold_badge): ENTERPRISE plan AND KYB verified (identity proof).
 */
export async function refreshBusinessBadges(businessId: string): Promise<void> {
  const supabase = createSupabaseServiceRoleClient();

  const [{ data: sub }, { data: profile }] = await Promise.all([
    supabase
      .from("business_subscriptions")
      .select("plan_slug")
      .eq("business_id", businessId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("business_profiles")
      .select("verified_domain, kyb_status")
      .eq("user_id", businessId)
      .maybeSingle(),
  ]);

  const paid = Boolean(
    sub &&
      (PAID_BUSINESS_PLANS as readonly string[]).includes(sub.plan_slug),
  );
  const hasVerifiedDomain = Boolean(profile?.verified_domain);
  const kybVerified = profile?.kyb_status === "verified";

  const verifiedBadge = paid && hasVerifiedDomain;
  const goldBadge = sub?.plan_slug === "business_enterprise" && kybVerified && hasVerifiedDomain;

  await supabase
    .from("business_profiles")
    .update({ verified_badge: verifiedBadge, gold_badge: goldBadge })
    .eq("user_id", businessId);
}

/** Job: recompute badges for every business. Used by the daily cron. */
export async function refreshAllBusinessBadges(): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: businesses } = await supabase
    .from("business_profiles")
    .select("user_id")
    .is("deleted_at", null);

  for (const business of businesses ?? []) {
    try {
      await refreshBusinessBadges(business.user_id);
    } catch {
      /* keep going — a single failure shouldn't abort the sweep */
    }
  }
  return businesses?.length ?? 0;
}
