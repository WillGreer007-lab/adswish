import { describe, it, expect } from "vitest";
import { checkTokenExpiry, formatDuration, needsRotation } from "@/lib/token-rotation";
import type { CampaignTokenPayload } from "@/lib/verification-token";

function makePayload(overrides: Partial<CampaignTokenPayload> = {}): CampaignTokenPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    business_id: "biz-1",
    platform: "youtube",
    handle: "@test",
    issued_at: now - 86400, // issued 1 day ago
    expires_at: now + 6 * 86400, // expires in 6 days
    version: "v1",
    ...overrides,
  };
}

describe("checkTokenExpiry", () => {
  it("returns active for a fresh token", () => {
    const payload = makePayload();
    const result = checkTokenExpiry(payload);
    expect(result.status).toBe("active");
    expect(result.remaining_seconds).toBeGreaterThan(0);
  });

  it("returns expired for a past token", () => {
    const payload = makePayload({ expires_at: Math.floor(Date.now() / 1000) - 3600 });
    const result = checkTokenExpiry(payload);
    expect(result.status).toBe("expired");
    expect(result.remaining_seconds).toBe(0);
  });

  it("returns expiring_soon for a token within 24h", () => {
    const payload = makePayload({
      issued_at: Math.floor(Date.now() / 1000) - 6 * 86400,
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour left
    });
    const result = checkTokenExpiry(payload);
    expect(result.status).toBe("expiring_soon");
  });

  it("returns warning for a token within 3 days", () => {
    const payload = makePayload({
      issued_at: Math.floor(Date.now() / 1000) - 5 * 86400,
      expires_at: Math.floor(Date.now() / 1000) + 2 * 86400, // 2 days left
    });
    const result = checkTokenExpiry(payload);
    expect(result.status).toBe("warning");
  });
});

describe("formatDuration", () => {
  it("formats days and hours", () => {
    expect(formatDuration(86400 * 2 + 3600 * 5)).toBe("2d 5h");
  });

  it("formats hours only", () => {
    expect(formatDuration(3600 * 3)).toBe("3h");
  });

  it("returns Expired for zero or negative", () => {
    expect(formatDuration(0)).toBe("Expired");
    expect(formatDuration(-100)).toBe("Expired");
  });
});

describe("needsRotation", () => {
  it("returns false for an active token", () => {
    const payload = makePayload();
    expect(needsRotation(payload)).toBe(false);
  });

  it("returns true for an expired token", () => {
    const payload = makePayload({ expires_at: Math.floor(Date.now() / 1000) - 3600 });
    expect(needsRotation(payload)).toBe(true);
  });

  it("returns true for a token expiring within 24h", () => {
    const payload = makePayload({
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });
    expect(needsRotation(payload)).toBe(true);
  });
});
