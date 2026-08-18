import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { filterPII, detectSpam } from "@/lib/security";

/**
 * POST /api/internal/messages — send a campaign message.
 * PII (emails/phones/external URLs) is masked before storage; spammy
 * (repetitive) messages are rejected. RLS enforces that the sender is a
 * campaign participant (business owner or accepted creator).
 */
export async function POST(request: NextRequest) {
  // Browser callers authenticate via the session cookie (same pattern as every
  // other /api/internal route). RLS then enforces that the sender is a
  // campaign participant.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const campaignId = body?.campaign_id ?? body?.campaignId;
  const rawBody = typeof body?.body === "string" ? body.body.trim() : "";

  if (!campaignId || !rawBody) {
    return NextResponse.json(
      { error: "campaign_id and body are required" },
      { status: 422 },
    );
  }

  // Cap message length (matches the messages.body text column).
  if (rawBody.length > 4000) {
    return NextResponse.json({ error: "Message too long (max 4000 chars)" }, { status: 422 });
  }

  // Verify the user is actually a participant of this campaign (defense in
  // depth on top of the RLS WITH CHECK — this returns a clear 403 instead of
  // a silent RLS violation).
  const { data: biz } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("business_id", user.id)
    .maybeSingle();
  const { data: creatorApp } = await supabase
    .from("applications")
    .select("campaign_id")
    .eq("campaign_id", campaignId)
    .eq("creator_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  if (!biz && !creatorApp) {
    return NextResponse.json({ error: "Not a participant of this campaign" }, { status: 403 });
  }

  // PII filter: mask emails/phones/external URLs in the stored body.
  const pii = filterPII(rawBody);
  const sanitized = pii.filtered;

  // Spam detection: reject rapid-fire identical messages from this sender.
  const { data: recent } = await supabase
    .from("messages")
    .select("body")
    .eq("sender_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3);

  if (detectSpam((recent ?? []).map((m: { body: string }) => m.body), 3)) {
    return NextResponse.json(
      { error: "Looks like spam — identical messages are blocked. Try again in a moment." },
      { status: 429 },
    );
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({ campaign_id: campaignId, sender_id: user.id, body: sanitized })
    .select("id, campaign_id, sender_id, body, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Unread badge: notify the other participant(s) so their notification bell
  // counts the new message. Uses the service-role client because RLS grants
  // users read/update on their own notifications but no INSERT policy.
  const serviceClient = createSupabaseServiceRoleClient();
  if (biz) {
    // Sender is the business owner → notify accepted creators.
    const { data: accepted } = await serviceClient
      .from("applications")
      .select("creator_id")
      .eq("campaign_id", campaignId)
      .eq("status", "accepted");
    for (const a of accepted ?? []) {
      await serviceClient.from("notifications").insert({
        user_id: a.creator_id,
        type: "message",
        body: "New message on your campaign conversation.",
        link: `/dashboard/creator/messages#chat-${campaignId}`,
      });
    }
  } else {
    // Sender is an accepted creator → notify the business owner.
    const { data: campaign } = await serviceClient
      .from("campaigns")
      .select("business_id")
      .eq("id", campaignId)
      .single();
    if (campaign) {
      await serviceClient.from("notifications").insert({
        user_id: campaign.business_id,
        type: "message",
        body: "New message from a creator on your campaign.",
        link: `/dashboard/business/messages#chat-${campaignId}`,
      });
    }
  }

  return NextResponse.json({ ok: true, message, pii_detected: pii.detected, pii_types: pii.detectedTypes }, { status: 201 });
}
