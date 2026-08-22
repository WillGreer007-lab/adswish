import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  KeyRound,
  MonitorUp,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  getUptimeRobotMonitors,
  uptimeRobotKey,
  type UptimeRobotMonitor,
  type UptimeRobotMonitorLog,
} from "@/lib/uptime-robot";

export const dynamic = "force-dynamic";

const MAX_MAPPED_MONITORS = 25;

type BusinessMapping = {
  company_name: string | null;
  uptime_robot_monitor_id: string | null;
};

type MonitorEvent = {
  monitor: UptimeRobotMonitor;
  businesses: string[];
  log: UptimeRobotMonitorLog;
};

function monitorStatus(status?: number): { label: string; className: string } {
  switch (status) {
    case 2:
      return { label: "Up", className: "text-success" };
    case 8:
      return { label: "Seems down", className: "text-warning" };
    case 9:
      return { label: "Down", className: "text-destructive" };
    case 0:
      return { label: "Paused", className: "text-background/50" };
    case 1:
      return { label: "Not checked yet", className: "text-warning" };
    default:
      return { label: "Unknown", className: "text-background/50" };
  }
}

function eventType(type?: number): { label: string; className: string } {
  switch (type) {
    case 1:
      return { label: "Down", className: "text-destructive" };
    case 2:
      return { label: "Up", className: "text-success" };
    case 98:
      return { label: "Paused", className: "text-warning" };
    case 99:
      return { label: "Started", className: "text-primary" };
    default:
      return { label: "Event", className: "text-background/60" };
  }
}

function eventReason(reason: UptimeRobotMonitorLog["reason"]): string {
  if (!reason) return "No reason supplied";
  if (typeof reason === "string") return reason;
  if (reason.detail) return reason.detail;
  if (reason.code !== undefined) return `Reason code ${reason.code}`;
  return "No reason supplied";
}

function formatWhen(timestamp?: number): string {
  if (!timestamp || !Number.isFinite(timestamp)) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp * 1000));
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds < 1) return "—";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return `${seconds}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return `${minutes}m`;
  const days = Math.floor(hours / 24);
  if (days < 1) return `${hours}h ${minutes % 60}m`;
  return `${days}d ${hours % 24}h`;
}

function safeMonitorUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function AdminUptimePage() {
  const monitorKey = uptimeRobotKey();
  const service = createSupabaseServiceRoleClient();
  const { data: mappingRows } = await service
    .from("business_profiles")
    .select("company_name, uptime_robot_monitor_id")
    .not("uptime_robot_monitor_id", "is", null)
    .limit(100);

  const businessesByMonitor = new Map<string, string[]>();
  for (const row of (mappingRows ?? []) as BusinessMapping[]) {
    const monitorId = row.uptime_robot_monitor_id?.trim();
    if (!monitorId || !/^\d+$/.test(monitorId)) continue;
    const businesses = businessesByMonitor.get(monitorId) ?? [];
    if (row.company_name && !businesses.includes(row.company_name)) businesses.push(row.company_name);
    businessesByMonitor.set(monitorId, businesses);
  }

  const mappedIds = [...businessesByMonitor.keys()].slice(0, MAX_MAPPED_MONITORS);
  const results = monitorKey
    ? await Promise.all(
        mappedIds.map((monitorId) =>
          getUptimeRobotMonitors({
            monitorId,
            key: monitorKey,
            includeLogs: true,
            limit: 50,
          }),
        ),
      )
    : [];

  const monitorRows = results.flatMap((result, index) => {
    const monitor = result.monitors.find((item) => String(item.id) === mappedIds[index]);
    if (!monitor) return [];
    return [
      {
        monitor,
        monitorId: mappedIds[index],
        businesses: businessesByMonitor.get(mappedIds[index]) ?? [],
      },
    ];
  });

  const events: MonitorEvent[] = monitorRows
    .flatMap(({ monitor, businesses }) =>
      (monitor.logs ?? []).map((log) => ({ monitor, businesses, log })),
    )
    .sort((a, b) => (b.log.datetime ?? 0) - (a.log.datetime ?? 0));
  const incidents = events.filter((event) => event.log.type === 1).slice(0, 25);
  const upCount = monitorRows.filter(({ monitor }) => monitor.status === 2).length;
  const downCount = monitorRows.filter(({ monitor }) => monitor.status === 8 || monitor.status === 9).length;
  const keyReachable = monitorKey ? results.some((result) => result.ok) : false;
  const failedMappings = monitorKey ? results.filter((result) => !result.ok).length : mappedIds.length;
  const keyDetail = !monitorKey
    ? "Not configured"
    : mappedIds.length === 0
      ? "Configured; map a business monitor to run a scoped probe"
      : keyReachable
        ? `${monitorRows.length} mapped monitor${monitorRows.length === 1 ? "" : "s"} reachable`
        : "UptimeRobot rejected the monitor request";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="mb-3 inline-flex items-center gap-1.5 text-xs text-background/60 hover:text-background"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Superadmin
          </Link>
          <h1 className="font-heading text-2xl font-bold text-background">Uptime monitoring</h1>
          <p className="mt-1 max-w-3xl text-sm text-background/60">
            Monitor-only operations for the monitors explicitly mapped by businesses. Credentials
            are checked and used only on the server; nothing is sent to the browser.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-background/10 bg-surface/5 px-3 py-2 text-xs text-background/60">
          <ShieldCheck className="h-4 w-4 text-success" /> Admin-only view
        </div>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-background/70">
        <p className="font-medium text-background">Monitor-only mode is active</p>
        <p className="mt-1 text-xs">
          Adswish does not request all-account monitor access and does not create, edit, pause, or
          delete UptimeRobot monitors. Businesses create their own monitor and save its ID in
          Tracking settings.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-background/10 bg-surface/5">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-background/60">Mapped monitors</p>
            <p className="mt-2 font-mono text-2xl font-bold text-background">{mappedIds.length}</p>
          </CardContent>
        </Card>
        <Card className="border-background/10 bg-surface/5">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-background/60">Monitors up</p>
            <p className="mt-2 font-mono text-2xl font-bold text-success">{upCount}</p>
          </CardContent>
        </Card>
        <Card className="border-background/10 bg-surface/5">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-background/60">Current down</p>
            <p className={`mt-2 font-mono text-2xl font-bold ${downCount > 0 ? "text-destructive" : "text-background"}`}>
              {downCount}
            </p>
          </CardContent>
        </Card>
        <Card className="border-background/10 bg-surface/5">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-background/60">Recent incidents</p>
            <p className={`mt-2 font-mono text-2xl font-bold ${incidents.length > 0 ? "text-destructive" : "text-background"}`}>
              {incidents.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-background/10 bg-surface/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-background">
            <KeyRound className="h-5 w-5" /> Monitor-scoped credential health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-background/10 bg-background/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-background">Mapped monitor key</p>
                <p className="mt-1 text-xs text-background/50">
                  Read access is limited to the monitor IDs businesses have explicitly mapped.
                </p>
              </div>
              {keyReachable ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              ) : monitorKey ? (
                <XCircle className="h-5 w-5 shrink-0 text-destructive" />
              ) : (
                <CircleAlert className="h-5 w-5 shrink-0 text-warning" />
              )}
            </div>
            <p className={`mt-4 text-xs font-medium ${keyReachable ? "text-success" : monitorKey ? "text-destructive" : "text-warning"}`}>
              {keyReachable ? "Reachable" : monitorKey ? "Unavailable" : "Not configured"}
            </p>
            <p className="mt-1 text-xs text-background/60">{keyDetail}</p>
            {failedMappings > 0 && (
              <p className="mt-2 text-xs text-warning">
                {failedMappings} mapped monitor{failedMappings === 1 ? "" : "s"} could not be read with this scoped key.
              </p>
            )}
          </div>
          <p className="mt-4 text-xs text-background/40">
            This page performs read-only probes. All-account read access and management operations
            are intentionally unavailable in monitor-only mode.
          </p>
        </CardContent>
      </Card>

      <Card className="border-background/10 bg-surface/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-background">
            <MonitorUp className="h-5 w-5" /> Mapped monitor status ({monitorRows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monitorRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-background/10 text-left text-background/60">
                    <th className="py-2 pr-4">Monitor</th>
                    <th className="py-2 pr-4">Mapped businesses</th>
                    <th className="py-2 pr-4">URL</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Interval</th>
                  </tr>
                </thead>
                <tbody>
                  {monitorRows.map(({ monitor, monitorId, businesses }) => {
                    const status = monitorStatus(monitor.status);
                    const url = safeMonitorUrl(monitor.url);
                    return (
                      <tr key={monitorId} className="border-b border-background/5 align-top">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-background">{monitor.friendly_name || "Unnamed monitor"}</p>
                          <p className="mt-1 font-mono text-xs text-background/50">ID {monitorId}</p>
                        </td>
                        <td className="py-3 pr-4 text-xs text-background/70">
                          {businesses.length > 0 ? businesses.join(", ") : "—"}
                        </td>
                        <td className="max-w-sm py-3 pr-4 text-xs text-background/70">
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-background hover:underline">
                              <span className="break-all">{url}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={`py-3 pr-4 font-medium ${status.className}`}>{status.label}</td>
                        <td className="py-3 text-background/60">
                          {monitor.monitor_interval ? `${monitor.monitor_interval}s` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-background/60">
              {mappedIds.length === 0 ? (
                <>
                  <CircleAlert className="h-4 w-4 text-warning" /> No businesses have mapped a monitor yet.
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-destructive" /> Mapped monitors are unavailable with the scoped key.
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-background/10 bg-surface/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-background">
              <CircleAlert className="h-5 w-5" /> Recent incidents ({incidents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {incidents.length > 0 ? (
              <div className="space-y-3">
                {incidents.map(({ monitor, businesses, log }, index) => {
                  const type = eventType(log.type);
                  return (
                    <div key={`${monitor.id}-${log.datetime ?? index}`} className="rounded-md border border-background/10 bg-background/5 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-background">{monitor.friendly_name || `Monitor ${monitor.id}`}</p>
                        <span className={`text-xs font-medium ${type.className}`}>{type.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-background/50">{businesses.join(", ") || "No business name"}</p>
                      <p className="mt-1 text-xs text-background/60">{eventReason(log.reason)}</p>
                      <p className="mt-2 text-xs text-background/40">
                        {formatWhen(log.datetime)} · lasted {formatDuration(log.duration)}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-background/60">
                {monitorRows.length > 0 ? "No down incidents were returned for mapped monitors." : "Incident history is unavailable until a mapped monitor can be read."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-background/10 bg-surface/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-background">
              <Clock3 className="h-5 w-5" /> Monitor history ({events.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-background/10 text-left text-background/60">
                      <th className="py-2 pr-3">When (UTC)</th>
                      <th className="py-2 pr-3">Monitor</th>
                      <th className="py-2 pr-3">Event</th>
                      <th className="py-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.slice(0, 25).map(({ monitor, log }, index) => {
                      const type = eventType(log.type);
                      return (
                        <tr key={`${monitor.id}-${log.datetime ?? index}`} className="border-b border-background/5 align-top">
                          <td className="py-3 pr-3 whitespace-nowrap text-xs text-background/60">{formatWhen(log.datetime)}</td>
                          <td className="py-3 pr-3 text-xs text-background">{monitor.friendly_name || `Monitor ${monitor.id}`}</td>
                          <td className={`py-3 pr-3 text-xs font-medium ${type.className}`}>{type.label}</td>
                          <td className="py-3 text-xs text-background/60">{formatDuration(log.duration)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-background/60">
                {monitorRows.length > 0 ? "No monitor events were returned." : "History is unavailable until a mapped monitor can be read."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 text-xs text-background/40">
        <Activity className="h-3.5 w-3.5" />
        UptimeRobot data is fetched server-side for mapped monitor IDs; key values never leave the server.
      </div>
    </div>
  );
}
