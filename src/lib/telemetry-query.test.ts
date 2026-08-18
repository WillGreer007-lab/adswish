import { describe, it, expect } from "vitest";
import {
  parseTelemetryFilter,
  sanitizeLike,
  parseBound,
  csvEscape,
} from "./telemetry-query";

describe("parseTelemetryFilter", () => {
  it("defaults to analytics when kind is missing", () => {
    expect(parseTelemetryFilter({}).kind).toBe("analytics");
  });

  it("selects error kind", () => {
    expect(parseTelemetryFilter({ kind: "error" }).kind).toBe("error");
  });

  it("sanitizes wildcards out of q and path", () => {
    const f = parseTelemetryFilter({ kind: "analytics", q: "a%b_c\\", path: "/d%ash" });
    expect(f.q).toBe("abc");
    expect(f.path).toBe("/dash");
  });

  it("truncates oversized inputs", () => {
    const f = parseTelemetryFilter({ q: "x".repeat(500), path: "y".repeat(500) });
    expect(f.q.length).toBeLessThanOrEqual(100);
    expect(f.path.length).toBeLessThanOrEqual(200);
  });

  it("parses date bounds; end-of-day applied to `to`", () => {
    const f = parseTelemetryFilter({ from: "2026-08-01", to: "2026-08-18" });
    expect(f.from).toBe("2026-08-01T00:00:00.000Z");
    expect(f.to).toBe("2026-08-18T23:59:59.999Z");
  });

  it("ignores invalid dates", () => {
    expect(parseTelemetryFilter({ from: "not-a-date" }).from).toBeNull();
  });
});

describe("sanitizeLike", () => {
  it("strips % _ and backslash", () => {
    expect(sanitizeLike("a%b_c\\d")).toBe("abcd");
  });
});

describe("parseBound", () => {
  it("returns null for empty/invalid input", () => {
    expect(parseBound("", false)).toBeNull();
    expect(parseBound("garbage", false)).toBeNull();
  });
});

describe("csvEscape", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("leaves plain values unquoted and null as empty", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(42)).toBe("42");
  });
});
