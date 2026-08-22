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
  error?: unknown;
  monitors?: UptimeRobotMonitor[];
  monitor?: { id?: number };
};

const API_BASE = "https://api.uptimerobot.com/v2";

/**
 * Return the server-only key for a specific operation. Never expose these
 * values to client components or include them in diagnostics.
 */
export function uptimeRobotKey(
  scope: "read" | "monitor" | "main",
): string | undefined {
  if (scope === "main") return process.env.UPTIME_ROBOT_MAIN_API_KEY || undefined;
  if (scope === "monitor") {
    return process.env.UPTIME_ROBOT_MONITOR_API_KEY || process.env.UPTIME_ROBOT_API_KEY || undefined;
  }
  return process.env.UPTIME_ROBOT_API_KEY || undefined;
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

/** Read every monitor, or only the explicitly mapped monitor. */
export async function getUptimeRobotMonitors(options: {
  monitorId?: string | null;
  key?: string;
  includeLogs?: boolean;
  limit?: number;
}): Promise<{
  ok: boolean;
  httpStatus: number;
  monitors: UptimeRobotMonitor[];
}> {
  const key = options.key || uptimeRobotKey(options.monitorId ? "monitor" : "read");
  if (!key) return { ok: false, httpStatus: 0, monitors: [] };

  const result = await callUptimeRobot("getMonitors", key, {
    logs: options.includeLogs ? "1" : "0",
    ...(options.limit ? { limit: String(Math.min(Math.max(options.limit, 1), 50)) } : {}),
    ...(options.monitorId ? { monitors: options.monitorId } : {}),
  });
  return {
    ok: result.ok,
    httpStatus: result.httpStatus,
    monitors: result.body?.monitors ?? [],
  };
}

export async function createUptimeRobotMonitor(options: {
  key: string;
  url: string;
  friendlyName: string;
}): Promise<{ ok: boolean; httpStatus: number; monitorId: string | null }> {
  const result = await callUptimeRobot("newMonitor", options.key, {
    type: "1",
    url: options.url,
    friendly_name: options.friendlyName.slice(0, 255),
    interval: "300",
    timeout: "30",
  });
  const id = result.body?.monitor?.id;
  return {
    ok: result.ok && typeof id === "number",
    httpStatus: result.httpStatus,
    monitorId: typeof id === "number" ? String(id) : null,
  };
}

export async function updateUptimeRobotMonitor(options: {
  key: string;
  monitorId: string;
  url: string;
  friendlyName: string;
}): Promise<{ ok: boolean; httpStatus: number }> {
  const result = await callUptimeRobot("editMonitor", options.key, {
    id: options.monitorId,
    type: "1",
    url: options.url,
    friendly_name: options.friendlyName.slice(0, 255),
    interval: "300",
    timeout: "30",
  });
  return { ok: result.ok, httpStatus: result.httpStatus };
}
