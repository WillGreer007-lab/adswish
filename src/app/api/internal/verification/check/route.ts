import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkThreshold, computeCampaignStatus } from "@/lib/campaign-verification";
import { calculateAuthenticityScore, type ScoreInput } from "@/lib/authenticity-scoring";
import type { SocialPlatform } from "@/lib/verification-token";

/**
 * POST /api/internal/verification/check
 * Verify a platform: check token posted, fetch follower count, compute score.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { campaign_id, platform } = body;

  if (!campaign_id || !platform) {
    return NextResponse.json({ error: "campaign_id and platform required" }, { status: 400 });
  }

  // Verify campaign ownership
  const { data: campaign } = await supabase
    .from("verification_campaigns")
    .select("id, business_id, selected_platforms, status")
    .eq("id", campaign_id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const { data: business } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", campaign.business_id)
    .single();

  if (!business || business.user_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Get the platform verification row
  const { data: pv, error: pvError } = await supabase
    .from("platform_verifications")
    .select("*")
    .eq("campaign_id", campaign_id)
    .eq("platform", platform)
    .single();

  if (pvError || !pv) {
    return NextResponse.json({ error: "Platform verification not found" }, { status: 404 });
  }

  // Mark as verifying
  await supabase
    .from("platform_verifications")
    .update({ status: "verifying", last_checked_at: new Date().toISOString() })
    .eq("id", pv.id);

  // In production: scrape the platform bio for the token and fetch follower count.
  // For now, the token_posted + follower_count are set via admin review or manual check.
  // This endpoint computes the authenticity score based on whatever data we have.

  const thresholdMet = checkThreshold(platform as SocialPlatform, pv.follower_count);

  // Compute authenticity score if we have data
  let authenticityScore = 0;
  if (pv.follower_count > 0) {
    const scoreInput: ScoreInput = {
      platform: platform as SocialPlatform,
      followers: pv.follower_count,
      avg_likes_per_post: 0, // populated by admin or scraping
      avg_comments_per_post: 0,
      avg_shares_per_post: 0,
      total_posts: 10,
      account_age_days: 365,
      follower_growth_30d: 0,
      cross_platform_verified: false, // computed separately
    };
    const scoreResult = calculateAuthenticityScore(scoreInput);
    authenticityScore = scoreResult.score;
  }

  // Determine final status
  const newStatus = pv.token_posted && thresholdMet ? "verified" : pv.token_posted ? "failed" : "pending";

  await supabase
    .from("platform_verifications")
    .update({
      status: newStatus,
      threshold_met: thresholdMet,
      authenticity_score: authenticityScore,
      verified_at: newStatus === "verified" ? new Date().toISOString() : null,
    })
    .eq("id", pv.id);

  // Recompute campaign status
  const { data: allPVs } = await supabase
    .from("platform_verifications")
    .select("platform, status, follower_count, threshold_met, token_posted")
    .eq("campaign_id", campaign_id);

  const selectedPlatforms = campaign.selected_platforms as SocialPlatform[];
  const newCampaignStatus = computeCampaignStatus(
    campaign.status as any,
    selectedPlatforms,
    (allPVs || []).map((r: any) => ({
      platform: r.platform as SocialPlatform,
      status: r.status,
      follower_count: r.follower_count,
      threshold_met: r.threshold_met,
      token_posted: r.token_posted,
    })),
  );

  await supabase
    .from("verification_campaigns")
    .update({ status: newCampaignStatus })
    .eq("id", campaign_id);

  return NextResponse.json({
    platform,
    status: newStatus,
    threshold_met: thresholdMet,
    authenticity_score: authenticityScore,
    campaign_status: newCampaignStatus,
  });
}
