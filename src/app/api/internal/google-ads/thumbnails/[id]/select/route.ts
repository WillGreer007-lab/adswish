import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/internal/google-ads/thumbnails/:id/select
 * Mark an A/B asset as the chosen thumbnail for its campaign and link it on
 * the google_ads_campaigns record (used to build the ad creative).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: asset } = await supabase
    .from("deliverable_ab_assets")
    .select("id, deliverable_id, campaign_id, user_id, status, image_url")
    .eq("id", id)
    .single();

  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  if (asset.user_id !== user.id) return NextResponse.json({ error: "Not your asset" }, { status: 403 });
  if (asset.status !== "ready" || !asset.image_url) {
    return NextResponse.json({ error: "Only ready thumbnails can be selected." }, { status: 422 });
  }

  // Deselect the previous choice for this deliverable, select this one.
  await supabase
    .from("deliverable_ab_assets")
    .update({ selected: false })
    .eq("deliverable_id", asset.deliverable_id)
    .eq("user_id", user.id);
  await supabase
    .from("deliverable_ab_assets")
    .update({ selected: true })
    .eq("id", asset.id);

  // Link the chosen asset on every google ads campaign built from this
  // Adswish campaign (usually one).
  await supabase
    .from("google_ads_campaigns")
    .update({ ab_asset_id: asset.id, updated_at: new Date().toISOString() })
    .eq("adswish_campaign_id", asset.campaign_id)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true, asset_id: asset.id });
}
