import { describe, it, expect } from "vitest";
import { parseTelemetryBody } from "./telemetry-server";

describe("parseTelemetryBody", () => {
  it("accepts a valid analytics event and normalizes it", () => {
    const res = parseTelemetryBody({
      kind: "analytics",
      event: "page_view",
      path: "/dashboard",
      referrer: "https://example.com",
      session_id: "s1",
      user_id: "u1",
      properties: { a: 1 },
      user_agent: "ua",
      ip_hash: "ip",
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.kind === "analytics") {
      expect(res.value.event).toBe("page_view");
      expect(res.value.path).toBe("/dashboard");
      expect(res.value.properties).toEqual({ a: 1 });
      expect(res.value.user_id).toBe("u1");
    }
  });

  it("accepts a valid error event", () => {
    const res = parseTelemetryBody({
      kind: "error",
      message: "boom",
      stack: "at x",
      source: "unhandledrejection",
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.kind === "error") {
      expect(res.value.message).toBe("boom");
    }
  });

  it("rejects unknown kinds", () => {
    expect(parseTelemetryBody({ kind: "nope" })).toEqual({
      ok: false,
      error: "unknown kind",
    });
  });

  it("rejects invalid or missing event names", () => {
    expect(parseTelemetryBody({ kind: "analytics", event: "bad event!" }).ok).toBe(false);
    expect(parseTelemetryBody({ kind: "analytics" }).ok).toBe(false);
    expect(parseTelemetryBody({ kind: "analytics", event: "" }).ok).toBe(false);
  });

  it("rejects error events without a message", () => {
    expect(parseTelemetryBody({ kind: "error" }).ok).toBe(false);
    expect(parseTelemetryBody({ kind: "error", message: "" }).ok).toBe(false);
  });

  it("truncates oversized text fields", () => {
    const res = parseTelemetryBody({
      kind: "analytics",
      event: "page_view",
      path: "x".repeat(1000),
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.path?.length).toBeLessThanOrEqual(512);
    }
  });

  it("rejects non-object bodies", () => {
    expect(parseTelemetryBody("hi").ok).toBe(false);
    expect(parseTelemetryBody(null).ok).toBe(false);
    expect(parseTelemetryBody([1, 2]).ok).toBe(false);
  });
});
