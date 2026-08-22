import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  generateToken,
  PLATFORM_THRESHOLDS,
  type SocialPlatform,
} from "@/lib/socialverify/tokens";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_PLATFORMS = new Set<SocialPlatform>(["youtube", "tiktok", "instagram", "twitter"]);

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { campaign_id, platform, handle, secret_key } = body ?? {};

  if (!campaign_id || !platform || !handle || !secret_key) {
    return NextResponse.json(
      { error: "campaign_id, platform, handle, and secret_key are required" },
      { status: 400 },
    );
  }
  if (!VALID_PLATFORMS.has(platform as SocialPlatform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const service = createSupabaseServiceRoleClient();
  const { data: campaign } = await service
    .from("verification_campaigns")
    .select("id, business_id")
    .eq("id", campaign_id)
    .single();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.business_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const token = generateToken(campaign.business_id, platform as SocialPlatform, handle, secret_key);

  const { error } = await service.from("platform_verifications").upsert(
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    display_code: token.display_code,
    full_token: token.full_token,
    expires_at: token.expires_at,
    platform,
    handle,
  });
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaignId = new URL(request.url).searchParams.get("campaign_id");
  if (!campaignId) return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });

  const service = createSupabaseServiceRoleClient();
  const { data: campaign } = await service
    .from("verification_campaigns")
    .select("id, business_id")
    .eq("id", campaignId)
    .single();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.business_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data, error } = await service
    .from("platform_verifications")
    .select("platform, handle, status, follower_count, follower_threshold, threshold_met, token_expires_at, authenticity_score, cross_platform_verified, verified_at, token_posted")
    .eq("campaign_id", campaignId)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tokens: data ?? [] });
}
