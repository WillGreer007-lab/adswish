import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { moderateContent } from "@/lib/moderation";
import { verifyHashtag } from "@/lib/hashtag";
import { isTrackingActive } from "@/lib/tracking-links";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { submitted_url } = body;

  if (!submitted_url) {
    return NextResponse.json({ error: "Missing submitted_url" }, { status: 400 });
  }

  let urlValid = false;
  try {
    new URL(submitted_url);
    urlValid = true;
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  const { data: deliverable } = await supabase
    .from("deliverables")
    .select("id, campaign_id, creator_id, status, required_hashtag")
    .eq("id", id)
    .single();

  if (!deliverable) {
    return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
  }

  if (deliverable.creator_id !== user.id) {
    return NextResponse.json({ error: "Not your deliverable" }, { status: 403 });
  }

  if (deliverable.status !== "pending" && deliverable.status !== "grace_period") {
    return NextResponse.json({ error: `Cannot submit deliverable in status: ${deliverable.status}` }, { status: 422 });
  }

  // §12 "pause all activity": block new submissions while fully paused.
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("status, pause_mode")
    .eq("id", deliverable.campaign_id)
    .single();
  if (campaign && !isTrackingActive(campaign)) {
    return NextResponse.json(
      { error: "This campaign is paused and not accepting submissions" },
      { status: 422 },
    );
  }

  // Real oEmbed verification with a substring fallback (blueprint §9).
  const hashtagCheck = await verifyHashtag(submitted_url, deliverable.required_hashtag);
  const hashtagFound = hashtagCheck.found;

  // Content moderation: auto-flag, never auto-reject (blueprint §9).
  const moderation = await moderateContent(submitted_url);
  const moderationStatus = moderation.flagged
    ? "flagged"
    : moderation.provider === "sightengine"
      ? "clean"
      : "not_checked";

  const { error } = await supabase
    .from("deliverables")
    .update({
      submitted_url,
      hashtag_verified: hashtagFound,
      status: "pending_business_review",
      moderation_status: moderationStatus,
      moderation_flagged_at: moderation.flagged ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (moderation.flagged) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("business_id")
      .eq("id", deliverable.campaign_id)
      .single();

    if (campaign) {
      await supabase.from("notifications").insert({
        user_id: campaign.business_id,
        type: "sla",
        body: "A submitted deliverable was flagged by content moderation for manual review.",
        link: `/dashboard/business/campaigns/${deliverable.campaign_id}`,
      });
    }
  }

  return NextResponse.json({
    success: true,
    hashtag_verified: hashtagFound,
    moderation: moderationStatus,
    message: hashtagFound
      ? moderation.flagged
        ? "URL submitted, but content was flagged for manual review."
        : "URL submitted. Hashtag verified."
      : "URL submitted. Hashtag not found — flagged for manual review.",
  });
}
