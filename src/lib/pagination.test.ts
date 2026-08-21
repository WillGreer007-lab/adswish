import { describe, it, expect } from "vitest";
import {
  encodeCursor,
  decodeCursor,
  parsePagination,
  nextCursor,
} from "./pagination";

describe("encodeCursor / decodeCursor", () => {
  it("round-trips a cursor", () => {
    const c = encodeCursor("2026-08-21T00:00:00.000Z", "uuid-123");
    expect(decodeCursor(c)).toEqual({ value: "2026-08-21T00:00:00.000Z", key: "uuid-123" });
  });

  it("returns null for a missing or malformed cursor", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("not-valid-base64!!")).toBeNull();
  });

  it("returns null when the decoded shape is wrong", () => {
    const bad = Buffer.from(JSON.stringify({ v: 1, k: "x" })).toString("base64");
    expect(decodeCursor(bad)).toBeNull();
  });
});

describe("parsePagination", () => {
  it("defaults to the requested page size", () => {
    const { limit, cursor } = parsePagination(new URLSearchParams());
    expect(limit).toBe(50);
    expect(cursor).toBeNull();
  });

  it("clamps the limit to 1..100", () => {
    expect(parsePagination(new URLSearchParams("limit=0")).limit).toBe(1);
    expect(parsePagination(new URLSearchParams("limit=9999")).limit).toBe(100);
    expect(parsePagination(new URLSearchParams("limit=25")).limit).toBe(25);
  });

  it("decodes a supplied cursor", () => {
    const c = encodeCursor("v", "k");
    const { cursor } = parsePagination(new URLSearchParams(`cursor=${c}`));
    expect(cursor).toEqual({ value: "v", key: "k" });
  });
});

describe("nextCursor", () => {
  it("returns a cursor when the page is full", () => {
    const rows = [{ id: "a", created_at: "2026-01-01" }, { id: "b", created_at: "2026-01-02" }];
    expect(nextCursor(rows, 2, "created_at")).toBe(encodeCursor("2026-01-02", "b"));
  });

  it("returns null when the page is short (end of data)", () => {
    const rows = [{ id: "a", created_at: "2026-01-01" }];
    expect(nextCursor(rows, 2, "created_at")).toBeNull();
  });

  it("returns null when the sort/key column is missing", () => {
    const rows = [{ id: "a" }];
    expect(nextCursor(rows, 1, "created_at")).toBeNull();
  });
});
