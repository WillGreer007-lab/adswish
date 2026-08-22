import { afterEach, describe, expect, it } from "vitest";
import { uptimeRobotKey } from "./uptime-robot";

const original = {
  read: process.env.UPTIME_ROBOT_API_KEY,
  monitor: process.env.UPTIME_ROBOT_MONITOR_API_KEY,
  main: process.env.UPTIME_ROBOT_MAIN_API_KEY,
};

afterEach(() => {
  process.env.UPTIME_ROBOT_API_KEY = original.read;
  process.env.UPTIME_ROBOT_MONITOR_API_KEY = original.monitor;
  process.env.UPTIME_ROBOT_MAIN_API_KEY = original.main;
});

describe("uptimeRobotKey", () => {
  it("keeps read and management credentials scoped to their operation", () => {
    process.env.UPTIME_ROBOT_API_KEY = "read-key";
    process.env.UPTIME_ROBOT_MONITOR_API_KEY = "monitor-key";
    process.env.UPTIME_ROBOT_MAIN_API_KEY = "main-key";

    expect(uptimeRobotKey("read")).toBe("read-key");
    expect(uptimeRobotKey("monitor")).toBe("monitor-key");
    expect(uptimeRobotKey("main")).toBe("main-key");
  });

  it("falls back to the read-only key for a mapped monitor", () => {
    process.env.UPTIME_ROBOT_API_KEY = "read-key";
    delete process.env.UPTIME_ROBOT_MONITOR_API_KEY;

    expect(uptimeRobotKey("monitor")).toBe("read-key");
  });
});
