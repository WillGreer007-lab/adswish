import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockClient, keyMock, monitorsMock } = vi.hoisted(() => ({
  mockClient: { current: null as any },
  keyMock: vi.fn(() => "monitor-key"),
  monitorsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => mockClient.current,
}));
vi.mock("@/lib/uptime-robot", () => ({
  uptimeRobotKey: keyMock,
  getUptimeRobotMonitors: monitorsMock,
}));

import { checkMappedUptimeMonitors } from "./uptime-monitor-alerts";

type Row = Record<string, unknown>;

function query(data: unknown, error: Row | null = null) {
  const q: any = {
    select: () => q,
    not: () => q,
    is: () => q,
    eq: () => q,
    maybeSingle: async () => ({ data, error }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve),
  };
  return q;
}

function makeClient(previous: Row | null = null) {
  const notifications: Row[] = [];
  const checks: Row[] = [];
  const states: Row[] = [];
  const client = {
    notifications,
    checks,
    states,
    from(table: string) {
      if (table === "business_profiles") {
        return query([{ user_id: "business-1", company_name: "Demo business", uptime_robot_monitor_id: "803802534" }]);
      }
      if (table === "uptime_monitor_states") {
        return {
          ...query(previous),
          upsert: async (payload: Row) => {
            states.push(payload);
            return { error: null };
          },
        };
      }
      if (table === "uptime_monitor_checks") {
        return {
          insert: async (payload: Row) => {
            checks.push(payload);
            return { error: null };
          },
        };
      }
      if (table === "notifications") {
        return {
          insert: async (payload: Row) => {
            notifications.push(payload);
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
  return client;
}

beforeEach(() => {
  keyMock.mockReturnValue("monitor-key");
  monitorsMock.mockResolvedValue({
    ok: true,
    httpStatus: 200,
    monitors: [{ id: 803802534, status: 9, friendly_name: "Demo monitor", url: "https://example.test" }],
  });
});

describe("checkMappedUptimeMonitors", () => {
  it("sends one outage notification and records the real scoped check", async () => {
    const client = makeClient({ last_alert_state: "up", outage_started_at: null });
    mockClient.current = client;

    const result = await checkMappedUptimeMonitors(new Date("2026-08-22T12:00:00.000Z"));

    expect(result).toMatchObject({ key_configured: true, mapped: 1, checked: 1, alerts_sent: 1, errors: 0 });
    expect(client.notifications).toHaveLength(1);
    expect(client.notifications[0]).toMatchObject({ user_id: "business-1", type: "uptime_outage" });
    expect(client.checks[0]).toMatchObject({ business_id: "business-1", monitor_id: "803802534", status: 9 });
    expect(client.states[0]).toMatchObject({ last_status: 9, last_alert_state: "down" });
    expect(monitorsMock).toHaveBeenCalledWith({ monitorId: "803802534", key: "monitor-key", includeLogs: false });
  });

  it("does not notify repeatedly while a mapped monitor remains down", async () => {
    const client = makeClient({ last_alert_state: "down", outage_started_at: "2026-08-22T11:50:00.000Z" });
    mockClient.current = client;

    const result = await checkMappedUptimeMonitors(new Date("2026-08-22T12:00:00.000Z"));

    expect(result.alerts_sent).toBe(0);
    expect(client.notifications).toHaveLength(0);
    expect(client.states[0]).toMatchObject({ last_alert_state: "down", outage_started_at: "2026-08-22T11:50:00.000Z" });
  });

  it("sends one recovery notification when the mapped monitor returns up", async () => {
    monitorsMock.mockResolvedValue({
      ok: true,
      httpStatus: 200,
      monitors: [{ id: 803802534, status: 2, friendly_name: "Demo monitor", url: "https://example.test" }],
    });
    const client = makeClient({ last_alert_state: "down", outage_started_at: "2026-08-22T11:50:00.000Z" });
    mockClient.current = client;

    const result = await checkMappedUptimeMonitors(new Date("2026-08-22T12:00:00.000Z"));

    expect(result.alerts_sent).toBe(1);
    expect(client.notifications[0]?.body).toContain("recovered");
    expect(client.states[0]).toMatchObject({ last_status: 2, last_alert_state: "up", outage_started_at: null });
  });
});
