import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { campaign_id, creator_id } = body;

  if (!campaign_id || !creator_id) {
    return NextResponse.json({ error: "Missing campaign_id or creator_id" }, { status: 400 });
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("business_id")
    .eq("id", campaign_id)
    .single();

  if (!campaign || campaign.business_id !== user.id) {
    return NextResponse.json({ error: "Only the business owner can bulk approve" }, { status: 403 });
  }

  const { data: pending, error: fetchError } = await supabase
    .from("deliverables")
    .select("id, slot_number")
    .eq("campaign_id", campaign_id)
    .eq("creator_id", creator_id)
    .eq("status", "pending_business_review")
    .order("slot_number", { ascending: true });

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  if (!pending || pending.length === 0) {
    return NextResponse.json({ error: "No pending deliverables found" }, { status: 404 });
  }

  const ids = pending.map((d) => d.id);
  const { error } = await supabase
    .from("deliverables")
    .update({
      business_approved: true,
      approved_at: new Date().toISOString(),
      status: "completed",
    })
    .in("id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("notifications").insert({
    user_id: creator_id,
    type: "payment",
    body: `${pending.length} deliverables approved! Payments are now in 7-day hold.`,
    link: `/dashboard/creator/campaigns/${campaign_id}`,
  });

  return NextResponse.json({ success: true, approved_count: pending.length });
}
