import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHmac } from "node:crypto";
import {
  generateCampaignToken,
  type SocialPlatform,
  PLATFORM_THRESHOLDS,
} from "@/lib/verification-token";

/**
 * POST /api/internal/verification/tokens
 * Generate verification tokens for one or more platforms in a campaign.
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
  const { campaign_id, platform, handle } = body;

  if (!campaign_id || !platform || !handle) {
    return NextResponse.json(
      { error: "campaign_id, platform, and handle required" },
      { status: 400 },
    );
  }

  const validPlatforms: SocialPlatform[] = ["youtube", "tiktok", "instagram", "twitter"];
  if (!validPlatforms.includes(platform as SocialPlatform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  // Verify campaign ownership
  const { data: campaign } = await supabase
    .from("verification_campaigns")
    .select("id, business_id, secret_key_hash")
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

  // Generate the token
  const secretKey = randomBytes(32).toString("hex"); // In production, retrieve from secure storage
  const token = generateCampaignToken(
    campaign.business_id,
    platform as SocialPlatform,
    handle,
    secretKey,
  );

  // Upsert platform verification row
  const { error: upsertError } = await supabase.from("platform_verifications").upsert(
    {
      campaign_id,
      platform,
      handle,
      verification_token: token.full_token,
      token_signature: token.signature,
      token_expires_at: token.expires_at,
      status: "pending",
      follower_count: 0,
      follower_threshold: PLATFORM_THRESHOLDS[platform as SocialPlatform],
      threshold_met: false,
    },
    { onConflict: "campaign_id,platform" },
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    display_code: token.display_code,
    full_token: token.full_token,
    expires_at: token.expires_at,
    platform,
    handle,
  });
}

/**
 * GET /api/internal/verification/tokens?campaign_id=...
 * Get all tokens for a campaign.
 */
export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaign_id");
  if (!campaignId) {
    return NextResponse.json({ error: "campaign_id required" }, { status: 400 });
  }

  // Verify campaign ownership
  const { data: campaign } = await supabase
    .from("verification_campaigns")
    .select("id, business_id")
    .eq("id", campaignId)
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

  const { data: tokens, error } = await supabase
    .from("platform_verifications")
    .select("platform, handle, status, follower_count, follower_threshold, threshold_met, token_expires_at, authenticity_score, cross_platform_verified, verified_at")
    .eq("campaign_id", campaignId)
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tokens });
}
