import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createTrackingLink } from "@/lib/tracking-links";

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

  const { data: deliverable } = await supabase
    .from("deliverables")
    .select("id, campaign_id, creator_id, slot_number, status")
    .eq("id", id)
    .single();

  if (!deliverable) {
    return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("business_id, type")
    .eq("id", deliverable.campaign_id)
    .single();

  if (!campaign || campaign.business_id !== user.id) {
    return NextResponse.json({ error: "Only the business owner can approve" }, { status: 403 });
  }

  if (deliverable.status !== "pending_business_review") {
    return NextResponse.json({ error: "Deliverable is not pending review" }, { status: 422 });
  }

  const { error } = await supabase
    .from("deliverables")
    .update({
      business_approved: true,
      approved_at: new Date().toISOString(),
      status: "completed",
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // §11 "on approval: the tracking link for that slot goes live" — Affiliate/
  // Hybrid only. Fixed-fee campaigns have nothing to track.
  let trackingSlug: string | null = null;
  if (campaign.type === "affiliate" || campaign.type === "hybrid") {
    const { data: profile } = await supabase
      .from("business_profiles")
      .select("verified_domain")
      .eq("user_id", campaign.business_id)
      .single();

    const destination = profile?.verified_domain
      ? /^https?:\/\//.test(profile.verified_domain)
        ? profile.verified_domain
        : `https://${profile.verified_domain}`
      : process.env.NEXT_PUBLIC_APP_DOMAIN || "https://adswish.com";

    const link = await createTrackingLink(
      {
        deliverableId: deliverable.id,
        creatorId: deliverable.creator_id,
        campaignId: deliverable.campaign_id,
        destinationUrl: destination,
      },
      supabase,
    );

    if (link) {
      trackingSlug = link.slug;
      await supabase
        .from("deliverables")
        .update({ tracking_link_id: link.id })
        .eq("id", id);
    }
  }

  await supabase.from("notifications").insert({
    user_id: deliverable.creator_id,
    type: "payment",
    body: `Your deliverable has been approved! Payment is now in 7-day hold.`,
    link: `/dashboard/creator/campaigns/${deliverable.campaign_id}`,
  });

  return NextResponse.json({
    success: true,
    message: "Deliverable approved. Next slot unlocked.",
    tracking_slug: trackingSlug,
  });
}
