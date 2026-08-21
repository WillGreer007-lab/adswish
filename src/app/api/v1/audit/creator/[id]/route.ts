import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * GET /api/v1/audit/creator/:id
 *
 * Public verification report — no login required. Returns the creator's
 * snapshotted verification history (platform, handle, follower count, threshold
 * met, token matched, tier) so anyone can independently confirm what is
 * verified. Mirrors the spec's "audits are publicly readable via a unique URL".
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = createSupabaseServiceRoleClient();

  const [{ data: audits }, { data: profile }] = await Promise.all([
    service
      .from("verification_audits")
      .select("id, platform, handle, follower_count, threshold, threshold_met, verification_token_matched, tier, created_at")
      .eq("creator_id", id)
      .order("created_at", { ascending: false }),
    service
      .from("creator_profiles")
      .select("display_name, tier")
      .eq("user_id", id)
      .maybeSingle(),
  ]);

  if (!audits || audits.length === 0) {
    return NextResponse.json(
      { creator_id: id, display_name: profile?.display_name ?? null, verified_platforms: 0, audits: [] },
      { status: 200 },
    );
  }

  return NextResponse.json({
    creator_id: id,
    display_name: profile?.display_name ?? null,
    tier: profile?.tier ?? null,
    verified_platforms: audits.length,
    audits,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
