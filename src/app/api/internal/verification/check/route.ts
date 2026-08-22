import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { PLATFORM_THRESHOLDS, type SocialPlatform } from "@/lib/socialverify/tokens";
import { calculateScore, type ScoreInput } from "@/lib/socialverify/scoring";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/internal/verification/check
 * Verify a platform: confirm the token was posted, check the follower
 * threshold, and compute an authenticity score. In a full production build the
 * `token_posted` + `follower_count` would come from scraping the public page;
 * here they are supplied by the caller (or already stored from admin review).
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const {
    campaign_id,
    platform,
    token_posted,
    follower_count,
    avg_likes_per_post,
    avg_comments_per_post,
    avg_shares_per_post,
    total_posts,
    account_age_days,
    follower_growth_30d,
  } = body ?? {};

  if (!campaign_id || !platform) {
    return NextResponse.json({ error: "campaign_id and platform are required" }, { status: 400 });
  }

  const service = createSupabaseServiceRoleClient();
  const { data: campaign } = await service
    .from("verification_campaigns")
    .select("id, business_id, selected_platforms, status")
    .eq("id", campaign_id)
    .single();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.business_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data: pv } = await service
    .from("platform_verifications")
    .select("*")
    .eq("campaign_id", campaign_id)
    .eq("platform", platform)
    .single();

  if (!pv) return NextResponse.json({ error: "Platform verification not found" }, { status: 404 });

  const threshold = PLATFORM_THRESHOLDS[platform as SocialPlatform];
  const count = typeof follower_count === "number" ? follower_count : pv.follower_count;
  const posted = typeof token_posted === "boolean" ? token_posted : pv.token_posted;
  const thresholdMet = count >= threshold;

  const scoreInput: ScoreInput = {
    platform: platform as SocialPlatform,
    followers: count,
    avg_likes_per_post: typeof avg_likes_per_post === "number" ? avg_likes_per_post : 0,
    avg_comments_per_post: typeof avg_comments_per_post === "number" ? avg_comments_per_post : 0,
    avg_shares_per_post: typeof avg_shares_per_post === "number" ? avg_shares_per_post : 0,
    total_posts: typeof total_posts === "number" ? total_posts : 10,
    account_age_days: typeof account_age_days === "number" ? account_age_days : 365,
    follower_growth_30d: typeof follower_growth_30d === "number" ? follower_growth_30d : 0,
    cross_platform_verified: (campaign.selected_platforms ?? []).length > 1,
  };
  const score = calculateScore(scoreInput);

  const newStatus = posted && thresholdMet ? "verified" : posted ? "failed" : "pending";

  await service
    .from("platform_verifications")
    .update({
      status: newStatus,
      follower_count: count,
      threshold_met: thresholdMet,
      token_posted: posted,
      authenticity_score: score.score,
      verified_at: newStatus === "verified" ? new Date().toISOString() : null,
      last_checked_at: new Date().toISOString(),
    })
    .eq("id", pv.id);

  return NextResponse.json({
    platform,
    status: newStatus,
    threshold_met: thresholdMet,
    follower_count: count,
    authenticity_score: score.score,
    score_status: score.status,
  });
}
