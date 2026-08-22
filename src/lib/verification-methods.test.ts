import { describe, expect, it } from "vitest";
import { automationStatus, manualStatus } from "@/lib/verification-methods";

describe("automationStatus", () => {
  it("is not_started with no connected accounts", () => {
    expect(automationStatus([])).toBe("not_started");
  });

  it("is completed when any active account is verified", () => {
    expect(
      automationStatus([{ platform: "instagram", verified_at: "2026-01-01", disconnected_at: null }]),
    ).toBe("completed");
  });

  it("ignores disconnected accounts", () => {
    expect(
      automationStatus([
        { platform: "instagram", verified_at: "2026-01-01", disconnected_at: "2026-02-01" },
      ]),
    ).toBe("not_started");
  });

  it("is failed when the last OAuth connect errored", () => {
    expect(automationStatus([], true)).toBe("failed");
  });

  it("prefers completed over a stale oauth error", () => {
    expect(
      automationStatus([{ platform: "youtube", verified_at: "2026-01-01" }], true),
    ).toBe("completed");
  });
});

describe("manualStatus", () => {
  it("is not_started with no submissions", () => {
    expect(manualStatus([])).toBe("not_started");
  });

  it("is requires_review while pending", () => {
    expect(manualStatus([{ status: "pending" }])).toBe("requires_review");
  });

  it("is completed once approved", () => {
    expect(manualStatus([{ status: "approved" }])).toBe("completed");
  });

  it("is failed when the latest was rejected", () => {
    expect(manualStatus([{ status: "rejected" }])).toBe("failed");
  });

  it("approved wins over a pending sibling", () => {
    expect(manualStatus([{ status: "pending" }, { status: "approved" }])).toBe("completed");
  });

  it("pending wins over a rejected sibling", () => {
    expect(manualStatus([{ status: "rejected" }, { status: "pending" }])).toBe("requires_review");
  });
});
