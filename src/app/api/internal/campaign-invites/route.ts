import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = user.user_metadata?.role;
  const service = createSupabaseServiceRoleClient();

  if (role === "business") {
    const { data } = await service
      .from("campaign_invites")
      .select("id, status, message, created_at, creator_id, campaign_id, campaigns(title), creator_profiles(display_name, profile_picture_url)")
      .eq("business_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    return NextResponse.json({ invites: data ?? [] });
  }

  const { data } = await service
    .from("campaign_invites")
    .select("id, status, message, created_at, campaign_id, business_id, campaigns(title), business_profiles(company_name, logo_url)")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ invites: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.user_metadata?.role !== "business") {
    return NextResponse.json({ error: "Business account required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { campaign_id, creator_id, message } = body ?? {};
  if (!campaign_id || !creator_id) {
    return NextResponse.json({ error: "campaign_id and creator_id required" }, { status: 400 });
  }

  const service = createSupabaseServiceRoleClient();

  const { data: campaign } = await service
    .from("campaigns")
    .select("id, business_id, title")
    .eq("id", campaign_id)
    .single();
  if (!campaign || campaign.business_id !== user.id) {
    return NextResponse.json({ error: "Not your campaign" }, { status: 403 });
  }

  const { data, error } = await service
    .from("campaign_invites")
    .insert({
      campaign_id,
      business_id: user.id,
      creator_id,
      message: message || null,
    })
    .select()
    .single();

  if (error) {
    // UNIQUE(campaign_id, creator_id) — treat as "already invited".
    if (error.code === "23505") {
      return NextResponse.json({ error: "Creator already invited to this campaign" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await service.from("notifications").insert({
    user_id: creator_id,
    type: "application",
    body: `You've been invited to the campaign "${campaign.title}".`,
    link: `/dashboard/creator/campaigns`,
  });

  return NextResponse.json({ invite: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { invite_id, action } = body ?? {};
  if (!invite_id || !["accept", "decline"].includes(action)) {
    return NextResponse.json({ error: "invite_id and action (accept|decline) required" }, { status: 400 });
  }

  const service = createSupabaseServiceRoleClient();
  const { data: invite } = await service
    .from("campaign_invites")
    .select("id, creator_id, campaign_id, business_id, status")
    .eq("id", invite_id)
    .single();

  if (!invite || invite.creator_id !== user.id || invite.status !== "pending") {
    return NextResponse.json({ error: "Invite not found or not actionable" }, { status: 404 });
  }

  const newStatus = action === "accept" ? "accepted" : "declined";
  await service
    .from("campaign_invites")
    .update({ status: newStatus })
    .eq("id", invite_id);

  // Accepting an invite auto-applies the creator to that campaign.
  if (action === "accept") {
    const { data: existing } = await service
      .from("applications")
      .select("id")
      .eq("campaign_id", invite.campaign_id)
      .eq("creator_id", invite.creator_id)
      .maybeSingle();

    if (!existing) {
      const { data: creatorProfile } = await service
        .from("creator_profiles")
        .select("tier")
        .eq("user_id", invite.creator_id)
        .single();

      const { error: appErr } = await service.from("applications").insert({
        campaign_id: invite.campaign_id,
        creator_id: invite.creator_id,
        status: "pending",
        cover_note: "Applied via campaign invite",
        tier_at_application: creatorProfile?.tier ?? "micro",
      });

      if (appErr) {
        return NextResponse.json({ error: appErr.message }, { status: 500 });
      }

      await service.from("notifications").insert({
        user_id: invite.business_id,
        type: "application",
        body: "A creator accepted your campaign invite and applied.",
        link: `/dashboard/business/campaigns/${invite.campaign_id}`,
      });
    }
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
