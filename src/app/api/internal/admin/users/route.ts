import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/admin/audit-log";
import {
  cancelPlanForAccount,
  resumePlanForAccount,
  type AccountRole,
} from "@/lib/admin/account-actions";

const PROFILE_TABLES = {
  creator: "creator_profiles",
  business: "business_profiles",
} as const;

type Action =
  | "suspend"
  | "activate"
  | "ban"
  | "strike"
  | "cancel_plan"
  | "resume_plan"
  | "terminate"
  | "pause_payments"
  | "resume_payments";

const ACTIONS: Action[] = [
  "suspend",
  "activate",
  "ban",
  "strike",
  "cancel_plan",
  "resume_plan",
  "terminate",
  "pause_payments",
  "resume_payments",
];

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: admin },
  } = await supabase.auth.getUser();

  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  const role = body.role as AccountRole;
  const action = body.action as Action;

  if (!userId || !(role in PROFILE_TABLES) || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: "user_id, role, and a valid action are required" }, { status: 400 });
  }
  if (userId === admin.id) {
    return NextResponse.json({ error: "You cannot change your own admin account status" }, { status: 400 });
  }

  const service = createSupabaseServiceRoleClient();
  const table = PROFILE_TABLES[role];

  const { data: target, error: targetError } = await service
    .from(table)
    .select("user_id, account_status, strikes")
    .eq("user_id", userId)
    .maybeSingle();

  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // --- Cancel plan: flip the account's subscription to canceled. ----------
  if (action === "cancel_plan") {
    const { stripeCanceled, previousPlan, previousStatus } = await cancelPlanForAccount(
      service,
      role,
      userId,
      body.cancel_stripe === true,
    );

    await logAdminAction({
      adminId: admin.id,
      actionType: "cancel_plan",
      targetEntityId: userId,
      metadata: { role, previous_plan: previousPlan, previous_status: previousStatus, stripe_canceled: stripeCanceled },
    });
    await service.from("notifications").insert({
      user_id: userId,
      type: "system",
      body: "Your Adswish subscription has been canceled by an administrator. Contact support if you believe this is a mistake.",
      link: "/dashboard",
    });
    return NextResponse.json({ ok: true, action: "cancel_plan", status: "canceled", stripe_canceled: stripeCanceled });
  }

  // --- Resume plan: restore a canceled subscription to active. -------------
  if (action === "resume_plan") {
    const { stripeResumed, planSlug } = await resumePlanForAccount(
      service,
      role,
      userId,
      body.resume_stripe === true,
    );

    await logAdminAction({
      adminId: admin.id,
      actionType: "resume_plan",
      targetEntityId: userId,
      metadata: { role, plan_slug: planSlug, stripe_resumed: stripeResumed },
    });
    await service.from("notifications").insert({
      user_id: userId,
      type: "system",
      body: "Your Adswish subscription has been restored by an administrator.",
      link: "/dashboard",
    });
    return NextResponse.json({ ok: true, action: "resume_plan", status: "active", stripe_resumed: stripeResumed });
  }

  // --- Terminate: cancel plan + ban + pause payouts in one step. ----------
  if (action === "terminate") {
    const now = new Date().toISOString();
    const { stripeCanceled } = await cancelPlanForAccount(service, role, userId, body.cancel_stripe === true);
    await service
      .from(table)
      .update({ account_status: "banned", payouts_paused_at: now, payouts_paused_by: admin.id })
      .eq("user_id", userId);

    await logAdminAction({
      adminId: admin.id,
      actionType: "terminate_account",
      targetEntityId: userId,
      metadata: { role, previous_status: target.account_status, stripe_canceled: stripeCanceled },
    });
    await service.from("notifications").insert({
      user_id: userId,
      type: "system",
      body: "Your Adswish account has been terminated by an administrator. Contact support if you believe this is a mistake.",
      link: "/account-suspended",
    });
    return NextResponse.json({ ok: true, action: "terminate", status: "banned", stripe_canceled: stripeCanceled });
  }

  // --- Pause / resume payments: stop or restore money movement. -----------
  if (action === "pause_payments" || action === "resume_payments") {
    const paused = action === "pause_payments";
    const now = new Date().toISOString();
    await service
      .from(table)
      .update({
        payouts_paused_at: paused ? now : null,
        payouts_paused_by: paused ? admin.id : null,
      })
      .eq("user_id", userId);

    await logAdminAction({
      adminId: admin.id,
      actionType: paused ? "pause_payments" : "resume_payments",
      targetEntityId: userId,
      metadata: { role },
    });
    await service.from("notifications").insert({
      user_id: userId,
      type: "system",
      body: paused
        ? "An administrator has paused payments on your account. Contact support for details."
        : "An administrator has resumed payments on your account.",
      link: "/dashboard",
    });
    return NextResponse.json({ ok: true, action, payouts_paused: paused });
  }

  // --- Existing status actions (suspend / activate / ban / strike). --------
  const nextStatus = action === "suspend" ? "suspended" : action === "ban" ? "banned" : "active";

  if (action === "strike") {
    const nextStrikes = Number(target.strikes ?? 0) + 1;
    const nextStatus = nextStrikes >= 3 ? "banned" : target.account_status === "banned" ? "banned" : "active";
    const { error: strikeError } = await service
      .from(table)
      .update({ strikes: nextStrikes, account_status: nextStatus })
      .eq("user_id", userId);

    if (strikeError) return NextResponse.json({ error: strikeError.message }, { status: 500 });

    await logAdminAction({
      adminId: admin.id,
      actionType: "manual_strike",
      targetEntityId: userId,
      metadata: { role, previous_strikes: target.strikes ?? 0, next_strikes: nextStrikes, next_status: nextStatus },
    });
    await service.from("notifications").insert({
      user_id: userId,
      type: "system",
      body: nextStrikes >= 3
        ? "A third strike was added to your account, which has been banned under the Adswish strike policy."
        : `An administrator added a strike to your account (${nextStrikes}/3).`,
      link: "/account-suspended",
    });
    return NextResponse.json({ ok: true, status: nextStatus, strikes: nextStrikes });
  }

  const { error: updateError } = await service
    .from(table)
    .update({ account_status: nextStatus })
    .eq("user_id", userId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const actionType = action === "suspend"
    ? "suspend_user"
    : action === "ban"
      ? "ban_user"
      : target.account_status === "banned"
        ? "unban_user"
        : "unsuspend_user";
  await logAdminAction({
    adminId: admin.id,
    actionType,
    targetEntityId: userId,
    metadata: { role, previous_status: target.account_status, next_status: nextStatus },
  });

  await service.from("notifications").insert({
    user_id: userId,
    type: "system",
    body:
      action === "suspend"
        ? "Your Adswish account has been suspended by an administrator. Contact support if you believe this is a mistake."
        : action === "ban"
          ? "Your Adswish account has been banned by an administrator. Contact support if you believe this is a mistake."
          : "Your Adswish account has been reactivated.",
    link: "/account-suspended",
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
