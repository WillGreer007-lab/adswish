export type UptimeRobotMonitorLog = {
  type?: number;
  datetime?: number;
  duration?: number;
  reason?: { code?: string | number; detail?: string } | string;
};

export type UptimeRobotMonitor = {
  id?: number;
  url?: string;
  friendly_name?: string;
  status?: number;
  create_datetime?: number;
  monitor_interval?: number;
  logs?: UptimeRobotMonitorLog[];
};

type UptimeRobotResponse = {
  stat?: string;
  monitors?: UptimeRobotMonitor[];
};

const API_BASE = "https://api.uptimerobot.com/v2";

/**
 * Return the only credential used by monitor-only mode. This key is scoped to
 * the monitor(s) explicitly mapped in Adswish and is never exposed to clients.
 */
export function uptimeRobotKey(): string | undefined {
  return process.env.UPTIME_ROBOT_MONITOR_API_KEY || undefined;
}

async function callUptimeRobot(
  endpoint: string,
  apiKey: string,
  parameters: Record<string, string>,
): Promise<{ ok: boolean; httpStatus: number; body: UptimeRobotResponse | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ api_key: apiKey, format: "json", ...parameters }),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as UptimeRobotResponse | null;
    return { ok: response.ok && body?.stat === "ok", httpStatus: response.status, body };
  } catch {
    return { ok: false, httpStatus: 0, body: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Read only the monitor explicitly mapped by the caller. */
export async function getUptimeRobotMonitors(options: {
  monitorId: string;
  key?: string;
  includeLogs?: boolean;
  limit?: number;
}): Promise<{
  ok: boolean;
  httpStatus: number;
  monitors: UptimeRobotMonitor[];
}> {
  const monitorId = options.monitorId.trim();
  const key = options.key || uptimeRobotKey();
  if (!key || !/^\d+$/.test(monitorId)) {
    return { ok: false, httpStatus: 0, monitors: [] };
  }

  const result = await callUptimeRobot("getMonitors", key, {
    logs: options.includeLogs ? "1" : "0",
    ...(options.limit ? { limit: String(Math.min(Math.max(options.limit, 1), 50)) } : {}),
    monitors: monitorId,
  });
  return {
    ok: result.ok,
    httpStatus: result.httpStatus,
    monitors: result.body?.monitors ?? [],
  };
}
