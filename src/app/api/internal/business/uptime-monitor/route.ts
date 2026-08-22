import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createUptimeRobotMonitor,
  updateUptimeRobotMonitor,
  uptimeRobotKey,
} from "@/lib/uptime-robot";

function isBusiness(user: { user_metadata?: Record<string, unknown> | null }) {
  return user.user_metadata?.role === "business";
}

function normalizeDomain(domain: string): string {
  const trimmed = domain.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function monitorName(companyName: string): string {
  const clean = companyName.trim().replace(/[\r\n]+/g, " ");
  return `Adswish — ${clean || "verified domain"} uptime`.slice(0, 255);
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

/**
 * Explicitly create a new monitor or update the business's mapped monitor.
 * This is never called by page load; it only runs after the business clicks
 * the provisioning button in Tracking settings.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isBusiness(user)) {
    return NextResponse.json({ error: "Business account required" }, { status: 403 });
  }

  const mainKey = uptimeRobotKey("main");
  if (!mainKey) {
    return NextResponse.json(
      { error: "Automatic monitor setup is not configured. Ask an administrator to add the main UptimeRobot key." },
      { status: 503 },
    );
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("company_name, verified_domain, uptime_robot_monitor_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.verified_domain) {
    return NextResponse.json(
      { error: "Verify your business domain before creating an uptime monitor." },
      { status: 400 },
    );
  }

  const url = normalizeDomain(profile.verified_domain);
  const friendlyName = monitorName(profile.company_name);
  const existingId = profile.uptime_robot_monitor_id;

  const result = existingId
    ? await updateUptimeRobotMonitor({
        key: mainKey,
        monitorId: existingId,
        url,
        friendlyName,
      })
    : await createUptimeRobotMonitor({
        key: mainKey,
        url,
        friendlyName,
      });

  if (!result.ok) {
    return NextResponse.json(
      { error: "UptimeRobot could not create or update the monitor. Check the main API key and monitor limits." },
      { status: 502 },
    );
  }

  const monitorId = existingId ?? ("monitorId" in result ? result.monitorId : null);
  if (!monitorId) {
    return NextResponse.json({ error: "UptimeRobot returned no monitor ID." }, { status: 502 });
  }

  if (!existingId) {
    const { error } = await supabase
      .from("business_profiles")
      .update({ uptime_robot_monitor_id: monitorId })
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    action: existingId ? "updated" : "created",
    uptime_robot_monitor_id: monitorId,
  });
}
