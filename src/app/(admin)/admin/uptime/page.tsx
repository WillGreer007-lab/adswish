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
import {
  getUptimeRobotMonitors,
  uptimeRobotKey,
  type UptimeRobotMonitor,
  type UptimeRobotMonitorLog,
} from "@/lib/uptime-robot";

export const dynamic = "force-dynamic";

type KeyHealth = {
  label: string;
  description: string;
  configured: boolean;
  reachable: boolean;
  monitorCount: number;
  detail: string;
};

type MonitorEvent = {
  monitor: UptimeRobotMonitor;
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
  if (!timestamp) return "—";
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

async function probeKey(key: string | undefined) {
  if (!key) return { ok: false, httpStatus: 0, monitors: [] as UptimeRobotMonitor[] };
  return getUptimeRobotMonitors({ key, limit: 1 });
}

function healthFromProbe(
  label: string,
  description: string,
  key: string | undefined,
  probe: { ok: boolean; httpStatus: number; monitors: UptimeRobotMonitor[] },
  detailWhenReachable: string,
): KeyHealth {
  if (!key) {
    return {
      label,
      description,
      configured: false,
      reachable: false,
      monitorCount: 0,
      detail: "Not configured",
    };
  }
  return {
    label,
    description,
    configured: true,
    reachable: probe.ok,
    monitorCount: probe.monitors.length,
    detail: probe.ok
      ? detailWhenReachable
      : probe.httpStatus === 0
        ? "Request failed or UptimeRobot is unreachable"
        : "UptimeRobot rejected this credential",
  };
}

export default async function AdminUptimePage() {
  const readKey = uptimeRobotKey("read");
  const monitorKey = process.env.UPTIME_ROBOT_MONITOR_API_KEY || undefined;
  const mainKey = uptimeRobotKey("main");

  const readResult = readKey
    ? await getUptimeRobotMonitors({ key: readKey, includeLogs: true, limit: 50 })
    : { ok: false, httpStatus: 0, monitors: [] as UptimeRobotMonitor[] };
  const [monitorProbe, mainProbe] = await Promise.all([
    probeKey(monitorKey),
    probeKey(mainKey),
  ]);

  const keyHealth: KeyHealth[] = [
    healthFromProbe(
      "Read-only / all monitors",
      "Used for fleet status, history, and incident reporting.",
      readKey,
      readResult,
      `${readResult.monitors.length} monitor${readResult.monitors.length === 1 ? "" : "s"} returned`,
    ),
    healthFromProbe(
      "Monitor-scoped",
      "Used for a business's explicitly mapped monitor.",
      monitorKey,
      monitorProbe,
      `${monitorProbe.monitors.length} permitted monitor${monitorProbe.monitors.length === 1 ? "" : "s"} returned`,
    ),
    healthFromProbe(
      "Main / management",
      "Reserved for explicit monitor provisioning from a business Tracking action.",
      mainKey,
      mainProbe,
      "Read probe passed; write permissions are not exercised here",
    ),
  ];

  const monitors = readResult.monitors;
  const events: MonitorEvent[] = monitors
    .flatMap((monitor) => (monitor.logs ?? []).map((log) => ({ monitor, log })))
    .sort((a, b) => (b.log.datetime ?? 0) - (a.log.datetime ?? 0));
  const incidents = events.filter((event) => event.log.type === 1).slice(0, 25);
  const upCount = monitors.filter((monitor) => monitor.status === 2).length;
  const downCount = monitors.filter((monitor) => monitor.status === 8 || monitor.status === 9).length;
  const configuredCount = keyHealth.filter((health) => health.configured).length;
  const healthyKeyCount = keyHealth.filter((health) => health.configured && health.reachable).length;

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
            Server-side health for UptimeRobot credentials, configured monitors, and recent
            incidents. Credentials are never rendered, logged, or sent to the browser.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-background/10 bg-surface/5 px-3 py-2 text-xs text-background/60">
          <ShieldCheck className="h-4 w-4 text-success" /> Admin-only view
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-background/10 bg-surface/5">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-background/60">Configured keys</p>
            <p className="mt-2 font-mono text-2xl font-bold text-background">
              {configuredCount} / {keyHealth.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-background/10 bg-surface/5">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-background/60">Reachable keys</p>
            <p className="mt-2 font-mono text-2xl font-bold text-success">
              {healthyKeyCount} / {configuredCount || keyHealth.length}
            </p>
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
            <p className="text-xs uppercase tracking-wide text-background/60">Down incidents</p>
            <p className={`mt-2 font-mono text-2xl font-bold ${downCount > 0 ? "text-destructive" : "text-background"}`}>
              {incidents.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-background/10 bg-surface/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-background">
            <KeyRound className="h-5 w-5" /> Credential scope health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-3">
            {keyHealth.map((health) => (
              <div key={health.label} className="rounded-lg border border-background/10 bg-background/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-background">{health.label}</p>
                    <p className="mt-1 text-xs text-background/50">{health.description}</p>
                  </div>
                  {health.reachable ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                  ) : health.configured ? (
                    <XCircle className="h-5 w-5 shrink-0 text-destructive" />
                  ) : (
                    <CircleAlert className="h-5 w-5 shrink-0 text-warning" />
                  )}
                </div>
                <p className={`mt-4 text-xs font-medium ${health.reachable ? "text-success" : health.configured ? "text-destructive" : "text-warning"}`}>
                  {health.reachable ? "Reachable" : health.configured ? "Unavailable" : "Not configured"}
                </p>
                <p className="mt-1 text-xs text-background/60">{health.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-background/40">
            This page performs read-only probes only. Monitor creation and edits remain behind the
            business&apos;s explicit Tracking action and never happen during page load.
          </p>
        </CardContent>
      </Card>

      <Card className="border-background/10 bg-surface/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-background">
            <MonitorUp className="h-5 w-5" /> Current monitor fleet ({monitors.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monitors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-background/10 text-left text-background/60">
                    <th className="py-2 pr-4">Monitor</th>
                    <th className="py-2 pr-4">URL</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Interval</th>
                  </tr>
                </thead>
                <tbody>
                  {monitors.map((monitor) => {
                    const status = monitorStatus(monitor.status);
                    const url = safeMonitorUrl(monitor.url);
                    return (
                      <tr key={String(monitor.id)} className="border-b border-background/5 align-top">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-background">{monitor.friendly_name || "Unnamed monitor"}</p>
                          <p className="mt-1 font-mono text-xs text-background/50">ID {monitor.id ?? "—"}</p>
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
              {readResult.ok ? <CircleAlert className="h-4 w-4 text-warning" /> : <XCircle className="h-4 w-4 text-destructive" />}
              {readResult.ok ? "The read-only key returned no monitors." : "Monitor fleet unavailable until the read-only key is configured and accepted."}
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
                {incidents.map(({ monitor, log }, index) => {
                  const type = eventType(log.type);
                  return (
                    <div key={`${monitor.id}-${log.datetime ?? index}`} className="rounded-md border border-background/10 bg-background/5 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-background">{monitor.friendly_name || `Monitor ${monitor.id}`}</p>
                        <span className={`text-xs font-medium ${type.className}`}>{type.label}</span>
                      </div>
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
                {readResult.ok ? "No down incidents were returned in the current UptimeRobot history window." : "Incident history is unavailable without an accepted read-only key."}
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
                {readResult.ok ? "No monitor events were returned." : "History is unavailable without an accepted read-only key."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 text-xs text-background/40">
        <Activity className="h-3.5 w-3.5" />
        UptimeRobot data is fetched server-side when this admin page loads; key values never leave the server.
      </div>
    </div>
  );
}
