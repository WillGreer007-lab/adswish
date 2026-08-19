import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { applyRefund, releaseConversion } from "@/lib/finance";
import { logAdminAction } from "@/lib/admin/audit-log";

const ACTIONS = ["dismiss", "force_release", "refund_business"] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user: admin } } = await supabase.auth.getUser();

  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const disputeId = typeof body.dispute_id === "string" ? body.dispute_id : "";
  const action = body.action as Action;
  if (!disputeId || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: "dispute_id and a valid action are required" }, { status: 400 });
  }

  const service = createSupabaseServiceRoleClient();
  const { data: dispute } = await service
    .from("sla_disputes")
    .select("id, status, related_conversion_id, related_deliverable_id, resolution")
    .eq("id", disputeId)
    .maybeSingle();

  if (!dispute) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  if (dispute.status !== "open" && dispute.status !== "in_review") {
    return NextResponse.json({ error: "This dispute has already been resolved" }, { status: 422 });
  }

  if ((action === "force_release" || action === "refund_business") && !dispute.related_conversion_id) {
    return NextResponse.json({ error: "This dispute has no linked conversion to settle" }, { status: 422 });
  }

  if (action === "force_release") {
    const released = await releaseConversion(dispute.related_conversion_id as string);
    if (!released) {
      return NextResponse.json({ error: "The linked conversion is no longer pending and could not be force-released" }, { status: 422 });
    }
  }

  if (action === "refund_business") {
    const { data: conversion } = await service
      .from("conversions")
      .select("order_amount")
      .eq("id", dispute.related_conversion_id)
      .single();
    const refunded = await applyRefund(dispute.related_conversion_id as string, Number(conversion?.order_amount ?? 0));
    if (!refunded) return NextResponse.json({ error: "The linked conversion could not be refunded" }, { status: 422 });
  }

  const resolution = action === "dismiss" ? "dismissed" : action === "force_release" ? "force_release" : "refund_business";
  const { error } = await service
    .from("sla_disputes")
    .update({ status: action === "dismiss" ? "dismissed" : "resolved", resolution, resolved_at: new Date().toISOString(), admin_id: admin.id })
    .eq("id", disputeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    adminId: admin.id,
    actionType: action === "force_release" ? "force_release" : action === "refund_business" ? "refund" : "resolve_dispute",
    targetEntityId: dispute.related_conversion_id || dispute.related_deliverable_id || dispute.id,
    metadata: { dispute_id: dispute.id, action, previous_status: dispute.status },
  });

  return NextResponse.json({ ok: true, status: action === "dismiss" ? "dismissed" : "resolved", resolution });
}
