import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateDeliverableThumbnails } from "@/lib/google-ads/thumbnails";

/**
 * A/B thumbnail assets for Google Ads creatives.
 *
 * GET  /api/internal/google-ads/thumbnails
 *   → the user's approved deliverables (with video) + their extracted assets
 * POST /api/internal/google-ads/thumbnails  { deliverable_id }
 *   → extract three thumbnail frames from that deliverable's video
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  type CampaignRef = { title: string | null } | { title: string | null }[] | null;
  type DeliverableRow = {
    id: string;
    campaign_id: string;
    status: string;
    video_url: string | null;
    campaigns: CampaignRef;
  };
  const campaignTitle = (ref: CampaignRef): string | null =>
    Array.isArray(ref) ? (ref[0]?.title ?? null) : (ref?.title ?? null);
  type AssetRow = {
    id: string;
    deliverable_id: string;
    variant: string;
    image_url: string | null;
    status: string;
    error: string | null;
    selected: boolean;
  };

  const { data: deliverables } = await supabase
    .from("deliverables")
    .select("id, campaign_id, status, video_url, campaigns(title)")
    .not("video_url", "is", null)
    .in("status", ["completed", "pending_business_review"])
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (deliverables ?? []) as unknown as DeliverableRow[];
  const { data: userCampaigns } = await supabase
    .from("campaigns")
    .select("id")
    .eq("business_id", user.id)
    .is("deleted_at", null);
  const ownedCampaignIds = new Set((userCampaigns ?? []).map((c: { id: string }) => c.id));

  const owned = rows.filter((d) => ownedCampaignIds.has(d.campaign_id));
  const deliverableIds = owned.map((d) => d.id);

  const { data: assets } = deliverableIds.length
    ? await supabase
        .from("deliverable_ab_assets")
        .select("id, deliverable_id, variant, image_url, status, error, selected")
        .in("deliverable_id", deliverableIds)
    : { data: [] as AssetRow[] };

  const assetsByDeliverable = new Map<string, AssetRow[]>();
  for (const a of (assets ?? []) as AssetRow[]) {
    const list = assetsByDeliverable.get(a.deliverable_id) ?? [];
    list.push(a);
    assetsByDeliverable.set(a.deliverable_id, list);
  }

  return NextResponse.json({
    deliverables: owned.map((d) => ({
      id: d.id,
      campaign_id: d.campaign_id,
      campaign_title: campaignTitle(d.campaigns),
      status: d.status,
      video_url: d.video_url,
      assets: assetsByDeliverable.get(d.id) ?? [],
    })),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { deliverable_id?: string };
  if (!body.deliverable_id) {
    return NextResponse.json({ error: "Missing deliverable_id" }, { status: 400 });
  }

  type CampaignRef = { business_id: string } | { business_id: string }[] | null;
  type DeliverableRow = {
    id: string;
    campaign_id: string;
    video_url: string | null;
    campaigns: CampaignRef;
  };
  const { data: rawDeliverable } = await supabase
    .from("deliverables")
    .select("id, campaign_id, video_url, campaigns(business_id)")
    .eq("id", body.deliverable_id)
    .single();
  const deliverable = rawDeliverable as unknown as DeliverableRow | null;

  if (!deliverable) {
    return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
  }
  const ownerId = Array.isArray(deliverable.campaigns)
    ? (deliverable.campaigns[0]?.business_id ?? null)
    : (deliverable.campaigns?.business_id ?? null);
  if (ownerId !== user.id) {
    return NextResponse.json({ error: "Not your campaign" }, { status: 403 });
  }
  if (!deliverable.video_url) {
    return NextResponse.json(
      { error: "This deliverable has no video attached yet." },
      { status: 422 },
    );
  }

  const result = await generateDeliverableThumbnails(
    { id: deliverable.id, campaign_id: deliverable.campaign_id, video_url: deliverable.video_url },
    user.id,
  );

  if (result.failed) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "Thumbnail extraction failed." },
      { status: 501 },
    );
  }

  return NextResponse.json({ ok: true, generated: result.generated });
}
