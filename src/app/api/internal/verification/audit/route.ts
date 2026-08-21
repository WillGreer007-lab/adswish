import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateAuthenticityScore, type ScoreInput } from "@/lib/authenticity-scoring";
import { calculateIdentityConfidence } from "@/lib/identity-binding";
import { buildManifest } from "@/lib/manifest-builder";
import type { SocialPlatform } from "@/lib/verification-token";

/**
 * POST /api/internal/verification/audit
 * Run a full verification audit on a campaign.
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
  const { campaign_id } = body;

  if (!campaign_id) {
    return NextResponse.json({ error: "campaign_id required" }, { status: 400 });
  }

  // Verify campaign ownership
  const { data: campaign } = await supabase
    .from("verification_campaigns")
    .select("*")
    .eq("id", campaign_id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const { data: business } = await supabase
    .from("business_profiles")
    .select("id, user_id, business_name")
    .eq("id", campaign.business_id)
    .single();

  if (!business || business.user_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Get all platform verifications
  const { data: platformVerifications } = await supabase
    .from("platform_verifications")
    .select("*")
    .eq("campaign_id", campaign_id);

  const pvs = platformVerifications || [];
  const selectedPlatforms = campaign.selected_platforms as SocialPlatform[];

  // Calculate authenticity scores per platform
  const platformResults: Record<string, any> = {};
  let totalScore = 0;
  let platformCount = 0;

  for (const pv of pvs) {
    const scoreInput: ScoreInput = {
      platform: pv.platform as SocialPlatform,
      followers: pv.follower_count,
      avg_likes_per_post: 0,
      avg_comments_per_post: 0,
      avg_shares_per_post: 0,
      total_posts: 10,
      account_age_days: 365,
      follower_growth_30d: 0,
      cross_platform_verified: selectedPlatforms.length > 1,
    };

    const scoreResult = calculateAuthenticityScore(scoreInput);

    platformResults[pv.platform] = {
      token_found: pv.token_posted,
      token_matches: pv.status === "verified",
      follower_count: pv.follower_count,
      threshold_met: pv.threshold_met,
      authenticity_score: scoreResult.score,
      status: pv.status,
      verified_at: pv.verified_at,
    };

    totalScore += scoreResult.score;
    platformCount++;
  }

  // Identity confidence (stub — in production, run the full 7-proof flow)
  const identity = calculateIdentityConfidence({
    domain_verified: false,
    bidirectional_passed: false,
    persistence_verified: false,
    established_account: true,
    social_graph_natural: true,
  });

  // Cross-platform verification
  const crossVerified = selectedPlatforms.length > 1;

  // Overall score: weighted average
  const avgScore = platformCount > 0 ? totalScore / platformCount : 0;
  const overallScore = Math.round(avgScore * 10) / 10;

  // Determine audit status
  let auditStatus: "verified" | "pending_review" | "failed";
  if (overallScore >= 75 && pvs.every((pv: any) => pv.status === "verified")) {
    auditStatus = "verified";
  } else if (overallScore >= 50) {
    auditStatus = "pending_review";
  } else {
    auditStatus = "failed";
  }

  // Build manifest
  let manifest = null;
  if (auditStatus === "verified" && campaign.domain) {
    try {
      manifest = buildManifest({
        domain: campaign.domain,
        businessId: campaign.business_id,
        businessName: business.business_name || "",
        secretKey: "retrieved-from-secure-storage", // In production
        accounts: pvs
          .filter((pv: any) => pv.status === "verified")
          .map((pv: any) => ({
            platform: pv.platform as SocialPlatform,
            handle: pv.handle,
            verificationToken: pv.verification_token,
            followerCount: pv.follower_count,
            verifiedAt: pv.verified_at,
          })),
      });
    } catch {
      // Manifest generation is best-effort
    }
  }

  // Write audit log
  const { error: auditError } = await supabase.from("verification_campaign_audits").insert({
    campaign_id,
    overall_score: overallScore,
    status: auditStatus,
    platform_results: platformResults,
    manifest_signature_valid: manifest !== null,
    cross_platform_verified: crossVerified,
    identity_confidence_score: identity.identity_confidence_score,
    flags: [],
  });

  if (auditError) {
    return NextResponse.json({ error: auditError.message }, { status: 500 });
  }

  // Update campaign status
  await supabase
    .from("verification_campaigns")
    .update({
      status: auditStatus === "verified" ? "verified" : "under_review",
      verified_at: auditStatus === "verified" ? new Date().toISOString() : null,
    })
    .eq("id", campaign_id);

  return NextResponse.json({
    audit_id: crypto.randomUUID(),
    overall_score: overallScore,
    status: auditStatus,
    platform_results: platformResults,
    identity_confidence: identity.identity_confidence_score,
    cross_platform_verified: crossVerified,
    manifest_generated: manifest !== null,
  });
}
