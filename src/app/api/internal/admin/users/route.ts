import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/admin/audit-log";

const PROFILE_TABLES = {
  creator: "creator_profiles",
  business: "business_profiles",
} as const;

type TargetRole = keyof typeof PROFILE_TABLES;
type Action = "suspend" | "activate" | "ban" | "strike";

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
  const role = body.role as TargetRole;
  const action = body.action as Action;

  if (!userId || !(role in PROFILE_TABLES) || !["suspend", "activate", "ban", "strike"].includes(action)) {
    return NextResponse.json({ error: "user_id, role, and a valid action are required" }, { status: 400 });
  }
  if (userId === admin.id) {
    return NextResponse.json({ error: "You cannot change your own admin account status" }, { status: 400 });
  }

  const service = createSupabaseServiceRoleClient();
  const table = PROFILE_TABLES[role];
  const nextStatus = action === "suspend" ? "suspended" : action === "ban" ? "banned" : "active";
  const { data: target, error: targetError } = await service
    .from(table)
    .select("user_id, account_status, strikes")
    .eq("user_id", userId)
    .maybeSingle();

  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

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
