export type UptimeAlertState = "none" | "up" | "down";
export type UptimeAlertKind = "outage" | "recovery";

export type PreviousUptimeMonitorState = {
  last_alert_state?: string | null;
  outage_started_at?: string | null;
};

export type UptimeMonitorTransition = {
  nextAlertState: UptimeAlertState;
  nextOutageStartedAt: string | null;
  notification: {
    kind: UptimeAlertKind;
    outageStartedAt: string | null;
  } | null;
};

function normalizeAlertState(value: string | null | undefined): UptimeAlertState {
  return value === "up" || value === "down" ? value : "none";
}

/**
 * Convert an UptimeRobot status into a single transition. UptimeRobot status
 * 8/9 means an outage, 2 means up, and paused/not-checked statuses are neutral.
 * Keeping this pure makes the notification de-duplication rules easy to test.
 */
export function getUptimeMonitorTransition(
  previous: PreviousUptimeMonitorState | null | undefined,
  status: number | null | undefined,
  nowIso: string,
): UptimeMonitorTransition {
  const previousState = normalizeAlertState(previous?.last_alert_state);
  const previousOutageStartedAt = previous?.outage_started_at ?? null;
  const isDown = status === 8 || status === 9;

  if (isDown) {
    const outageStartedAt = previousState === "down" && previousOutageStartedAt
      ? previousOutageStartedAt
      : nowIso;
    return {
      nextAlertState: "down",
      nextOutageStartedAt: outageStartedAt,
      notification: previousState === "down"
        ? null
        : { kind: "outage", outageStartedAt },
    };
  }

  if (status === 2) {
    return {
      nextAlertState: "up",
      nextOutageStartedAt: null,
      notification: previousState === "down"
        ? { kind: "recovery", outageStartedAt: previousOutageStartedAt }
        : null,
    };
  }

  return {
    nextAlertState: previousState,
    nextOutageStartedAt: previousOutageStartedAt,
    notification: null,
  };
}
