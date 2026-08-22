import { describe, expect, it } from "vitest";
import { getUptimeMonitorTransition } from "./uptime-monitor-state";

const now = "2026-08-22T12:00:00.000Z";

 describe("getUptimeMonitorTransition", () => {
  it("alerts once when a mapped monitor first goes down", () => {
    const transition = getUptimeMonitorTransition({ last_alert_state: "up", outage_started_at: null }, 9, now);

    expect(transition.nextAlertState).toBe("down");
    expect(transition.nextOutageStartedAt).toBe(now);
    expect(transition.notification).toEqual({ kind: "outage", outageStartedAt: now });
  });

  it("does not repeat alerts while the monitor remains down", () => {
    const started = "2026-08-22T11:50:00.000Z";
    const transition = getUptimeMonitorTransition({ last_alert_state: "down", outage_started_at: started }, 8, now);

    expect(transition.notification).toBeNull();
    expect(transition.nextOutageStartedAt).toBe(started);
  });

  it("sends one recovery notification when a down monitor returns up", () => {
    const started = "2026-08-22T11:50:00.000Z";
    const transition = getUptimeMonitorTransition({ last_alert_state: "down", outage_started_at: started }, 2, now);

    expect(transition.nextAlertState).toBe("up");
    expect(transition.nextOutageStartedAt).toBeNull();
    expect(transition.notification).toEqual({ kind: "recovery", outageStartedAt: started });
  });

  it("treats paused and not-checked statuses as neutral", () => {
    const transition = getUptimeMonitorTransition({ last_alert_state: "up", outage_started_at: null }, 0, now);

    expect(transition.notification).toBeNull();
    expect(transition.nextAlertState).toBe("up");
  });

  it("does not fabricate a recovery notification without a recorded outage", () => {
    const transition = getUptimeMonitorTransition(null, 2, now);

    expect(transition.notification).toBeNull();
    expect(transition.nextAlertState).toBe("up");
  });
});
