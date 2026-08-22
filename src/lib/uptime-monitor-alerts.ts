import pino from "pino";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getUptimeRobotMonitors, uptimeRobotKey } from "@/lib/uptime-robot";
import { getUptimeMonitorTransition, type UptimeAlertState } from "@/lib/uptime-monitor-state";

const logger = pino({ name: "uptime-monitor-alerts" });

export type UptimeAlertJobResult = {
  key_configured: boolean;
  mapped: number;
  checked: number;
  alerts_sent: number;
  errors: number;
};

type MappingRow = {
  user_id: string;
  company_name: string | null;
  uptime_robot_monitor_id: string | null;
};

type PreviousState = {
  last_alert_state: UptimeAlertState | null;
  outage_started_at: string | null;
};

function monitorStatusLabel(status: number | undefined): string {
  switch (status) {
    case 2:
      return "up";
    case 8:
      return "seems down";
    case 9:
      return "down";
    case 0:
      return "paused";
    case 1:
      return "not checked yet";
    default:
      return "unknown";
  }
}

function monitorName(name: string | undefined, monitorId: string): string {
  const trimmed = name?.trim().slice(0, 160);
  return trimmed || `Monitor ${monitorId}`;
}

async function saveState(
  service: ReturnType<typeof createSupabaseServiceRoleClient>,
  values: Record<string, unknown>,
): Promise<string | null> {
  const { error } = await service
    .from("uptime_monitor_states")
    .upsert(values, { onConflict: "business_id,monitor_id" });
  return error?.message ?? null;
}

async function recordCheck(
  service: ReturnType<typeof createSupabaseServiceRoleClient>,
  values: Record<string, unknown>,
): Promise<string | null> {
  const { error } = await service.from("uptime_monitor_checks").insert(values);
  return error?.message ?? null;
}

/**
 * Poll only explicitly mapped monitor IDs with the monitor-scoped credential.
 * A down transition sends one in-app notification; repeated down polls are
 * silent until UptimeRobot reports recovery, which sends one recovery notice.
 */
export async function checkMappedUptimeMonitors(now: Date = new Date()): Promise<UptimeAlertJobResult> {
  const key = uptimeRobotKey();
  const result: UptimeAlertJobResult = {
    key_configured: Boolean(key),
    mapped: 0,
    checked: 0,
    alerts_sent: 0,
    errors: 0,
  };

  if (!key) {
    logger.warn("Skipping mapped monitor alerts: monitor-scoped key is not configured");
    return result;
  }

  const service = createSupabaseServiceRoleClient();
  const { data: mappings, error: mappingError } = await service
    .from("business_profiles")
    .select("user_id, company_name, uptime_robot_monitor_id")
    .not("uptime_robot_monitor_id", "is", null)
    .is("deleted_at", null);

  if (mappingError) {
    logger.error({ error: mappingError.message }, "Could not load mapped UptimeRobot monitors");
    result.errors += 1;
    return result;
  }

  for (const mapping of (mappings ?? []) as MappingRow[]) {
    const monitorId = mapping.uptime_robot_monitor_id?.trim() ?? "";
    if (!/^\d+$/.test(monitorId)) continue;
    result.mapped += 1;

    const nowIso = now.toISOString();
    const { data: previous, error: stateError } = await service
      .from("uptime_monitor_states")
      .select("last_alert_state, outage_started_at")
      .eq("business_id", mapping.user_id)
      .eq("monitor_id", monitorId)
      .maybeSingle();

    if (stateError) {
      logger.error({ business_id: mapping.user_id, monitor_id: monitorId, error: stateError.message }, "Could not read UptimeRobot alert state");
      result.errors += 1;
      continue;
    }

    const previousState = (previous ?? null) as PreviousState | null;
    const monitorResult = await getUptimeRobotMonitors({
      monitorId,
      key,
      includeLogs: false,
    });
    const monitor = monitorResult.monitors.find((item) => String(item.id) === monitorId);

    if (!monitorResult.ok || !monitor) {
      const detail = !monitorResult.ok
        ? monitorResult.httpStatus === 0
          ? "UptimeRobot unreachable"
          : "UptimeRobot rejected the scoped monitor request"
        : `Mapped monitor ${monitorId} was not returned`;
      const checkSaveError = await recordCheck(service, {
        business_id: mapping.user_id,
        monitor_id: monitorId,
        checked_at: nowIso,
        error_message: detail,
      });
      if (checkSaveError) {
        result.errors += 1;
        logger.error({ business_id: mapping.user_id, monitor_id: monitorId, error: checkSaveError }, "Could not record failed UptimeRobot check");
      }

      const stateSaveError = await saveState(service, {
        business_id: mapping.user_id,
        monitor_id: monitorId,
        last_checked_at: nowIso,
        last_alert_state: previousState?.last_alert_state ?? "none",
        outage_started_at: previousState?.outage_started_at ?? null,
        last_error: detail,
      });
      if (stateSaveError) logger.error({ business_id: mapping.user_id, monitor_id: monitorId, error: stateSaveError }, "Could not save failed UptimeRobot check");
      result.errors += 1;
      continue;
    }

    result.checked += 1;
    const checkSaveError = await recordCheck(service, {
      business_id: mapping.user_id,
      monitor_id: monitorId,
      status: monitor.status ?? null,
      monitor_name: monitor.friendly_name ?? null,
      monitor_url: monitor.url ?? null,
      checked_at: nowIso,
      error_message: null,
    });
    if (checkSaveError) {
      result.errors += 1;
      logger.error({ business_id: mapping.user_id, monitor_id: monitorId, error: checkSaveError }, "Could not record UptimeRobot check");
    }

    const transition = getUptimeMonitorTransition(previousState, monitor.status, nowIso);
    let nextAlertState = transition.nextAlertState;
    let nextOutageStartedAt = transition.nextOutageStartedAt;
    let lastError: string | null = null;

    if (transition.notification) {
      const name = monitorName(monitor.friendly_name, monitorId);
      const isOutage = transition.notification.kind === "outage";
      const body = isOutage
        ? `UptimeRobot reports ${name} is ${monitorStatusLabel(monitor.status)}. Your external tracking check may be unavailable.`
        : `UptimeRobot reports ${name} is up again. Your external tracking check has recovered.`;
      const { error: notificationError } = await service.from("notifications").insert({
        user_id: mapping.user_id,
        type: "uptime_outage",
        body,
        link: "/dashboard/business/tracking",
      });

      if (notificationError) {
        lastError = notificationError.message;
        nextAlertState = previousState?.last_alert_state ?? "none";
        nextOutageStartedAt = previousState?.outage_started_at ?? null;
        result.errors += 1;
        logger.error({ business_id: mapping.user_id, monitor_id: monitorId, error: notificationError.message }, "Could not send UptimeRobot notification");
      } else {
        result.alerts_sent += 1;
      }
    }

    const stateSaveError = await saveState(service, {
      business_id: mapping.user_id,
      monitor_id: monitorId,
      last_status: monitor.status ?? null,
      last_monitor_name: monitor.friendly_name ?? null,
      last_monitor_url: monitor.url ?? null,
      last_checked_at: nowIso,
      outage_started_at: nextOutageStartedAt,
      last_alert_state: nextAlertState,
      last_error: lastError,
    });
    if (stateSaveError) {
      result.errors += 1;
      logger.error({ business_id: mapping.user_id, monitor_id: monitorId, error: stateSaveError }, "Could not save UptimeRobot monitor state");
    }
  }

  return result;
}
