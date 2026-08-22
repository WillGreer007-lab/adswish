import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUptimeRobotMonitors, uptimeRobotKey } from "@/lib/uptime-robot";

function normalizeDomain(domain: string): string {
  const trimmed = domain.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

type ThirdPartyResult = {
  enabled: boolean;
  ok: boolean;
  detail: string;
  mappingConfigured: boolean;
  mappingOk: boolean;
};

/**
 * Check only the monitor explicitly mapped to this business. Monitor-only
 * mode does not guess by hostname or use an all-account credential.
 */
async function uptimeRobotCheck(
  domain: string | undefined,
  monitorId: string | null | undefined,
): Promise<ThirdPartyResult> {
  const normalizedMonitorId = monitorId?.trim() || "";
  const mappingConfigured = Boolean(normalizedMonitorId);

  if (!mappingConfigured) {
    return {
      enabled: false,
      ok: false,
      detail: "Add your UptimeRobot monitor ID below to enable this optional check",
      mappingConfigured: false,
      mappingOk: false,
    };
  }

  const key = uptimeRobotKey();
  if (!key) {
    return {
      enabled: false,
      ok: false,
      detail: "Monitor-only uptime check is not configured on the server",
      mappingConfigured: true,
      mappingOk: false,
    };
  }
  if (!domain) {
    return {
      enabled: true,
      ok: false,
      detail: "No verified domain yet",
      mappingConfigured: true,
      mappingOk: false,
    };
  }

  const result = await getUptimeRobotMonitors({
    monitorId: normalizedMonitorId,
    key,
  });
  if (!result.ok) {
    return {
      enabled: true,
      ok: false,
      detail: result.httpStatus === 0 ? "UptimeRobot unreachable" : "UptimeRobot API rejected the monitor request",
      mappingConfigured: true,
      mappingOk: false,
    };
  }

  const match = result.monitors.find((monitor) => String(monitor.id) === normalizedMonitorId);
  if (!match) {
    return {
      enabled: true,
      ok: false,
      detail: `Mapped UptimeRobot monitor ${normalizedMonitorId} was not found`,
      mappingConfigured: true,
      mappingOk: false,
    };
  }

  const up = match.status === 2;
  return {
    enabled: true,
    ok: up,
    detail: `${match.friendly_name || `Monitor ${normalizedMonitorId}`} — ${
      up ? "up" : match.status === 0 ? "paused" : match.status === 1 ? "not checked yet" : "down"
    }`,
    mappingConfigured: true,
    mappingOk: true,
  };
}

/**
 * GET /api/internal/tracking/status
 *
 * The response separates the in-house pixel/link check, verified-domain
 * reachability, and optional mapped-monitor check so the dashboard can explain
 * exactly which prerequisite is blocking tracking.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.user_metadata?.role !== "business") {
    return NextResponse.json({ error: "Business account required" }, { status: 403 });
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("verified_domain, uptime_robot_monitor_id")
    .eq("user_id", user.id)
    .single();

  const [campaigns, links] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, pixel_status, last_pixel_ping_at")
      .eq("business_id", user.id)
      .is("deleted_at", null),
    supabase
      .from("tracking_links")
      .select("id, revoked_at, campaigns!inner(business_id)")
      .eq("campaigns.business_id", user.id)
      .is("revoked_at", null),
  ]);

  const databaseOk = !campaigns.error && !links.error;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const hasLivePixel = (campaigns.data ?? []).some(
    (campaign) =>
      campaign.pixel_status === "active" &&
      campaign.last_pixel_ping_at &&
      Date.now() - new Date(campaign.last_pixel_ping_at).getTime() < DAY_MS,
  );

  const linkIds = (links.data ?? []).map((link: { id: string }) => link.id);
  let hasClickedLink = false;
  if (linkIds.length > 0) {
    const { data: clicks } = await supabase
      .from("clicks_log")
      .select("id")
      .in("tracking_link_id", linkIds)
      .limit(1);
    hasClickedLink = (clicks ?? []).length > 0;
  }

  const domain = profile?.verified_domain;
  let externalOk = false;
  let externalDetail = "No verified domain yet";
  if (domain) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(normalizeDomain(domain), {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
        cache: "no-store",
        headers: { "User-Agent": "Adswish-Tracking-Check/1.0" },
      });
      clearTimeout(timer);
      externalOk = response.status < 400;
      externalDetail = `${domain} → HTTP ${response.status}`;
    } catch {
      externalDetail = `${domain} unreachable`;
    }
  }

  const thirdParty = await uptimeRobotCheck(domain, profile?.uptime_robot_monitor_id);
  const inhouseOk = hasLivePixel || hasClickedLink;
  const fullyActive = inhouseOk && externalOk && (!thirdParty.enabled || thirdParty.ok);

  return NextResponse.json({
    inhouse: {
      ok: inhouseOk,
      label: "In-house pixel check",
      detail: hasLivePixel
        ? "Live pixel heartbeat received (last 24h)"
        : hasClickedLink
          ? "Tracking link receiving clicks"
          : "No live pixel heartbeat or clicked tracking link yet — install the pixel or share a link",
    },
    external: {
      ok: externalOk,
      label: "External domain check",
      detail: externalDetail,
    },
    thirdParty: {
      ok: thirdParty.ok,
      enabled: thirdParty.enabled,
      label: "Mapped UptimeRobot monitor",
      detail: thirdParty.detail,
    },
    diagnostics: {
      application: {
        ok: true,
        detail: "Adswish tracking status endpoint is responding",
      },
      database: {
        ok: databaseOk,
        detail: databaseOk ? "Tracking tables are reachable" : "Tracking data could not be read",
      },
      verifiedDomain: {
        ok: Boolean(domain),
        detail: domain ? `Verified domain: ${domain}` : "Add and verify a business domain",
      },
      monitorMapping: {
        ok: thirdParty.mappingConfigured && thirdParty.mappingOk,
        configured: thirdParty.mappingConfigured,
        detail: thirdParty.mappingConfigured
          ? thirdParty.mappingOk
            ? "Saved monitor ID was found with the monitor-scoped key"
            : "Saved monitor ID could not be found with the monitor-scoped key"
          : "Save a numeric UptimeRobot monitor ID to enable monitor-only verification",
      },
      externalMonitor: {
        ok: thirdParty.ok,
        enabled: thirdParty.enabled,
        detail: thirdParty.detail,
      },
    },
    fully_active: fullyActive,
  });
}
