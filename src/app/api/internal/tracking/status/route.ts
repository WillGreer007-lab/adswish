import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizeDomain(domain: string): string {
  const trimmed = domain.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Optional third layer: UptimeRobot monitors the verified domain and reports
 * up/down independently of our own servers. Only active when
 * UPTIME_ROBOT_API_KEY is set; when configured it participates in the
 * `fully_active` gate. UptimeRobot monitor `status`:
 *   0 = paused, 1 = not checked yet, 2 = up, 8 = seems down, 9 = down.
 */
async function uptimeRobotCheck(domain: string | undefined): Promise<{
  enabled: boolean;
  ok: boolean;
  detail: string;
}> {
  const apiKey = process.env.UPTIME_ROBOT_API_KEY;
  if (!apiKey) {
    return {
      enabled: false,
      ok: false,
      detail: "Not configured — add UPTIME_ROBOT_API_KEY to enable",
    };
  }
  if (!domain) {
    return { enabled: true, ok: false, detail: "No verified domain yet" };
  }

  const host = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://api.uptimerobot.com/v2/getMonitors", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ api_key: apiKey, format: "json", logs: "0" }),
      cache: "no-store",
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { enabled: true, ok: false, detail: `UptimeRobot HTTP ${res.status}` };
    }

    const json = (await res.json()) as {
      stat?: string;
      monitors?: Array<{ url?: string; friendly_name?: string; status?: number }>;
    };
    if (json.stat !== "ok") {
      return { enabled: true, ok: false, detail: "UptimeRobot API error" };
    }

    const match = (json.monitors ?? []).find((m) => {
      try {
        return new URL(m.url ?? "").hostname === host;
      } catch {
        return false;
      }
    });

    if (!match) {
      return { enabled: true, ok: false, detail: `${host} is not monitored in UptimeRobot yet` };
    }

    const up = match.status === 2;
    return {
      enabled: true,
      ok: up,
      detail: `${match.friendly_name || host} — ${up ? "up" : match.status === 0 ? "paused" : "down"}`,
    };
  } catch {
    return { enabled: true, ok: false, detail: "UptimeRobot unreachable" };
  }
}

/**
 * GET /api/internal/tracking/status
 * Checks, all of which must pass before tracking is "fully active":
 *   1. in-house  — a live pixel heartbeat (campaign.pixel_status = active) or
 *                  a non-revoked tracking link owned by the business.
 *   2. external  — the verified domain is reachable over HTTPS.
 *   3. thirdParty (optional) — UptimeRobot reports the domain as up.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.user_metadata?.role !== "business") {
    return NextResponse.json({ error: "Business account required" }, { status: 403 });
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("verified_domain")
    .eq("user_id", user.id)
    .single();

  // In-house check: a live pixel heartbeat (last 24h) or a tracking link that
  // has actually been used. A merely-existing, never-clicked tracking link no
  // longer counts (fixes the "green with no setup" false positive).
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

  const DAY_MS = 24 * 60 * 60 * 1000;
  const hasLivePixel = (campaigns.data ?? []).some(
    (c) =>
      c.pixel_status === "active" &&
      c.last_pixel_ping_at &&
      Date.now() - new Date(c.last_pixel_ping_at).getTime() < DAY_MS,
  );

  const linkIds = (links.data ?? []).map((l: { id: string }) => l.id);
  let hasClickedLink = false;
  if (linkIds.length > 0) {
    const { data: clicks } = await supabase
      .from("clicks_log")
      .select("id")
      .in("tracking_link_id", linkIds)
      .limit(1);
    hasClickedLink = (clicks ?? []).length > 0;
  }

  // External check: is the verified domain reachable?
  const domain = profile?.verified_domain;
  let externalOk = false;
  let externalDetail = "No verified domain yet";
  if (domain) {
    const url = normalizeDomain(domain);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
        cache: "no-store",
        headers: { "User-Agent": "Adswish-Tracking-Check/1.0" },
      });
      clearTimeout(timer);
      externalOk = res.status < 400;
      externalDetail = `${domain} → HTTP ${res.status}`;
    } catch {
      externalOk = false;
      externalDetail = `${domain} unreachable`;
    }
  }

  const thirdParty = await uptimeRobotCheck(domain);

  const inhouseOk = hasLivePixel || hasClickedLink;
  const fullyActive =
    inhouseOk && externalOk && (!thirdParty.enabled || thirdParty.ok);

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
    fully_active: fullyActive,
  });
}
