import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function isBusiness(user: { user_metadata?: Record<string, unknown> | null }) {
  return user.user_metadata?.role === "business";
}

/** Save or clear an explicit monitor mapping without contacting UptimeRobot. */
export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isBusiness(user)) {
    return NextResponse.json({ error: "Business account required" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    uptime_robot_monitor_id?: unknown;
  };
  const raw = body.uptime_robot_monitor_id;
  const monitorId = typeof raw === "string" ? raw.trim() : "";

  if (monitorId && !/^\d+$/.test(monitorId)) {
    return NextResponse.json(
      { error: "UptimeRobot monitor ID must contain numbers only." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("business_profiles")
    .update({ uptime_robot_monitor_id: monitorId || null })
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, uptime_robot_monitor_id: monitorId || null });
}
