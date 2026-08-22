import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * GET /api/v1/audit/business/:id
 *
 * Public SocialVerify report for a business — no login required. Returns the
 * business's latest verification campaign, its per-platform verifications, and
 * the most recent audit, so anyone can independently confirm what is verified.
 * Mirrors the creator report at /api/v1/audit/creator/:id.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = createSupabaseServiceRoleClient();

  const [{ data: profile }, { data: campaign }] = await Promise.all([
    service.from("business_profiles").select("company_name").eq("user_id", id).maybeSingle(),
    service
      .from("verification_campaigns")
      .select("*")
      .eq("business_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!campaign) {
    return NextResponse.json(
      {
        business_id: id,
        company_name: profile?.company_name ?? null,
        campaign: null,
        platforms: [],
        audit: null,
        verified_platforms: 0,
      },
      { status: 200 },
    );
  }

  const [{ data: platforms }, { data: audit }] = await Promise.all([
    service
      .from("platform_verifications")
      .select(
        "platform, handle, follower_count, follower_threshold, threshold_met, status, token_posted, verified_at",
      )
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: true }),
    service
      .from("verification_campaign_audits")
      .select(
        "overall_score, status, platform_results, manifest_signature_valid, cross_platform_verified, identity_confidence_score, created_at",
      )
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const verifiedPlatforms = (platforms ?? []).filter((p: any) => p.status === "verified").length;

  return NextResponse.json({
    business_id: id,
    company_name: profile?.company_name ?? null,
    campaign: {
      id: campaign.id,
      status: campaign.status,
      domain: campaign.domain ?? null,
      business_name: campaign.business_name ?? "",
      selected_platforms: campaign.selected_platforms ?? [],
      verified_at: campaign.verified_at ?? null,
    },
    platforms: platforms ?? [],
    audit: audit ?? null,
    verified_platforms: verifiedPlatforms,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
