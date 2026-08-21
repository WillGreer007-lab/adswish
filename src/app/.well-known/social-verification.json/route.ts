import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SocialPlatform } from "@/lib/verification-token";
import { PLATFORM_THRESHOLDS } from "@/lib/verification-token";

/**
 * GET /.well-known/social-verification.json?business_id=...
 * Public manifest endpoint — no auth required.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("business_id");
  if (!businessId) {
    return NextResponse.json({ error: "business_id required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: campaign } = await supabase
    .from("verification_campaigns")
    .select("id, business_id, domain, business_name, selected_platforms")
    .eq("business_id", businessId)
    .eq("status", "verified")
    .order("verified_at", { ascending: false })
    .limit(1)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "No verified campaign found" }, { status: 404 });
  }

  const { data: pvs } = await supabase
    .from("platform_verifications")
    .select("platform, handle, verification_token, follower_count, verified_at, status")
    .eq("campaign_id", campaign.id)
    .eq("status", "verified");

  const accounts = (pvs || []).map((pv: any) => {
    const threshold = PLATFORM_THRESHOLDS[pv.platform as SocialPlatform];
    const urlMap: Record<string, (h: string) => string> = {
      youtube: (h) => `https://youtube.com/${h}`,
      tiktok: (h) => `https://tiktok.com/${h}`,
      instagram: (h) => `https://instagram.com/${h.replace(/^@/, "")}`,
      twitter: (h) => `https://twitter.com/${h.replace(/^@/, "")}`,
    };

    return {
      platform: pv.platform,
      handle: pv.handle,
      url: (urlMap[pv.platform] || (() => ""))(pv.handle),
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
