import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { PLATFORM_THRESHOLDS, type SocialPlatform } from "@/lib/socialverify/tokens";

export const runtime = "nodejs";

const URL_BUILDERS: Record<SocialPlatform, (h: string) => string> = {
  youtube: (h) => `https://youtube.com/${h}`,
  tiktok: (h) => `https://tiktok.com/${h}`,
  instagram: (h) => `https://instagram.com/${h.replace(/^@/, "")}`,
  twitter: (h) => `https://twitter.com/${h.replace(/^@/, "")}`,
};

/**
 * GET /.well-known/social-verification.json?business_id=...
 * Public manifest — no auth required.
 */
export async function GET(request: NextRequest) {
  const businessId = new URL(request.url).searchParams.get("business_id");
  if (!businessId) return NextResponse.json({ error: "business_id is required" }, { status: 400 });

  const service = createSupabaseServiceRoleClient();
  const { data: campaign } = await service
    .from("verification_campaigns")
    .select("id, business_id, domain, business_name, selected_platforms")
    .eq("business_id", businessId)
    .eq("status", "verified")
    .order("verified_at", { ascending: false })
    .limit(1)
    .single();

  if (!campaign) return NextResponse.json({ error: "No verified campaign found" }, { status: 404 });

  const { data: pvs } = await service
    .from("platform_verifications")
    .select("platform, handle, verification_token, follower_count, verified_at, status")
    .eq("campaign_id", campaign.id)
    .eq("status", "verified");

  const accounts = (pvs ?? []).map((pv: any) => {
    const threshold = PLATFORM_THRESHOLDS[pv.platform as SocialPlatform];
    return {
      platform: pv.platform,
      handle: pv.handle,
      url: (URL_BUILDERS[pv.platform as SocialPlatform] ?? (() => ""))(pv.handle),
      verification_token: pv.verification_token,
      follower_count: pv.follower_count,
      follower_threshold: threshold,
      threshold_met: pv.follower_count >= threshold,
      verified_at: pv.verified_at,
    };
  });

  return NextResponse.json({
    domain: campaign.domain,
    business_id: campaign.business_id,
    business_name: campaign.business_name,
    selected_platforms: campaign.selected_platforms,
    accounts,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  });
}
