import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUptimeRobotMonitors, uptimeRobotKey } from "@/lib/uptime-robot";

function normalizeDomain(domain: string): string {
  const trimmed = domain.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function domainHostname(domain: string): string | null {
  try {
    return new URL(normalizeDomain(domain)).hostname;
  } catch {
    return null;
  }
}

type ThirdPartyResult = {
  enabled: boolean;
  ok: boolean;
  detail: string;
  mappingConfigured: boolean;
  mappingOk: boolean;
};

/**
 * Check UptimeRobot without exposing credentials. A mapped monitor uses the
 * monitor-scoped key when available; an unmapped business uses the read-only
 * key and falls back to verified-hostname matching.
 */
async function uptimeRobotCheck(
  domain: string | undefined,
  monitorId: string | null | undefined,
): Promise<ThirdPartyResult> {
  const mappingConfigured = Boolean(monitorId);
  const key = uptimeRobotKey(mappingConfigured ? "monitor" : "read");

  if (!key) {
    return {
      enabled: false,
      ok: false,
      detail: "Not configured — an UptimeRobot read-only key is required",
      mappingConfigured,
      mappingOk: !mappingConfigured,
    };
  }
  if (!domain) {
    return {
      enabled: true,
      ok: false,
      detail: "No verified domain yet",
      mappingConfigured,
      mappingOk: false,
    };
  }

  const result = await getUptimeRobotMonitors({ monitorId, key });
  if (!result.ok) {
    return {
      enabled: true,
      ok: false,
      detail: result.httpStatus === 0 ? "UptimeRobot unreachable" : "UptimeRobot API rejected the request",
      mappingConfigured,
      mappingOk: false,
    };
  }

  const host = domainHostname(domain);
  const match = mappingConfigured
    ? result.monitors.find((monitor) => String(monitor.id) === monitorId)
    : result.monitors.find((monitor) => domainHostname(monitor.url ?? "") === host);

  if (!match) {
    return {
      enabled: true,
      ok: false,
      detail: mappingConfigured
        ? `Mapped UptimeRobot monitor ${monitorId} was not found`
        : `${host ?? domain} is not monitored in UptimeRobot yet`,
      mappingConfigured,
      mappingOk: false,
    };
  }

  const up = match.status === 2;
  return {
    enabled: true,
    ok: up,
    detail: `${match.friendly_name || host || "Mapped monitor"} — ${
      up ? "up" : match.status === 0 ? "paused" : match.status === 1 ? "not checked yet" : "down"
    }`,
    mappingConfigured,
    mappingOk: true,
  };
}

/**
 * GET /api/internal/tracking/status
 *
 * The response separates the in-house pixel/link check, verified-domain
 * reachability, and optional UptimeRobot check so the dashboard can explain
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
      label: "Third-party uptime check",
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
        ok: thirdParty.mappingOk,
        configured: thirdParty.mappingConfigured,
        detail: thirdParty.mappingConfigured
          ? thirdParty.mappingOk
            ? "Mapped monitor was found for this account"
            : "Mapped monitor could not be found with the configured key"
          : "Hostname matching is active; no explicit monitor mapping",
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
