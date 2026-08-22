import { afterEach, describe, expect, it } from "vitest";
import { uptimeRobotKey } from "./uptime-robot";

const original = {
  read: process.env.UPTIME_ROBOT_API_KEY,
  monitor: process.env.UPTIME_ROBOT_MONITOR_API_KEY,
  main: process.env.UPTIME_ROBOT_MAIN_API_KEY,
};

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore("UPTIME_ROBOT_API_KEY", original.read);
  restore("UPTIME_ROBOT_MONITOR_API_KEY", original.monitor);
  restore("UPTIME_ROBOT_MAIN_API_KEY", original.main);
});

describe("uptimeRobotKey", () => {
  it("returns only the monitor-scoped credential", () => {
    process.env.UPTIME_ROBOT_MONITOR_API_KEY = "monitor-key";
    process.env.UPTIME_ROBOT_API_KEY = "read-key";
    process.env.UPTIME_ROBOT_MAIN_API_KEY = "main-key";

    expect(uptimeRobotKey()).toBe("monitor-key");
  });

  it("does not fall back to the removed all-monitor or management credentials", () => {
    delete process.env.UPTIME_ROBOT_MONITOR_API_KEY;
    process.env.UPTIME_ROBOT_API_KEY = "read-key";
    process.env.UPTIME_ROBOT_MAIN_API_KEY = "main-key";

    expect(uptimeRobotKey()).toBeUndefined();
  });
});
