import { describe, it, expect } from "vitest";
import {
  generateToken,
  verifyToken,
  checkExpiry,
  formatDuration,
  needsRotation,
  PLATFORM_THRESHOLDS,
  type TokenPayload,
} from "./tokens";

const SECRET = "test-secret-key";

function makePayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    business_id: "biz-1",
    platform: "youtube",
    handle: "@test",
    issued_at: now - 86400,
    expires_at: now + 6 * 86400,
    version: "v1",
    ...overrides,
  };
}

describe("generateToken", () => {
  it("generates a display code and full token", () => {
    const t = generateToken("biz-123", "youtube", "@channel", SECRET);
    expect(t.display_code).toMatch(/^VERIFY-[A-Z0-9-]{1,6}-C-YO-[a-z0-9]{8}$/);
    expect(t.full_token).toMatch(/^VERIFY-/);
    expect(t.signature).toHaveLength(32);
    expect(t.payload.platform).toBe("youtube");
    expect(t.payload.handle).toBe("@channel");
  });

  it("produces different tokens per platform", () => {
    const yt = generateToken("biz-123", "youtube", "@ch", SECRET);
    const ig = generateToken("biz-123", "instagram", "@ch", SECRET);
    expect(yt.signature).not.toBe(ig.signature);
    expect(yt.display_code).not.toBe(ig.display_code);
  });

  it("sets expiry 7 days out by default", () => {
    const t = generateToken("biz-123", "twitter", "@x", SECRET);
    const expires = new Date(t.expires_at).getTime();
    const sevenDays = 7 * 24 * 3600 * 1000;
    expect(expires).toBeGreaterThan(Date.now() + sevenDays - 5000);
    expect(expires).toBeLessThan(Date.now() + sevenDays + 5000);
  });
});

describe("verifyToken", () => {
  it("verifies a valid token", () => {
    const t = generateToken("biz-456", "tiktok", "@tt", SECRET);
    const result = verifyToken(t.full_token, t.signature, SECRET);
    expect(result.valid).toBe(true);
    expect(result.expired).toBe(false);
    expect(result.tampered).toBe(false);
    expect(result.platform).toBe("tiktok");
    expect(result.handle).toBe("@tt");
  });

  it("rejects a tampered signature", () => {
    const t = generateToken("biz-456", "youtube", "@yt", SECRET);
    const result = verifyToken(t.full_token, "tampered-signature", SECRET);
    expect(result.valid).toBe(false);
    expect(result.tampered).toBe(true);
  });

  it("rejects a token signed with the wrong secret", () => {
    const t = generateToken("biz-456", "youtube", "@yt", SECRET);
    const result = verifyToken(t.full_token, t.signature, "wrong-secret");
    expect(result.valid).toBe(false);
    expect(result.tampered).toBe(true);
  });
});

describe("checkExpiry", () => {
  it("returns active for a fresh token", () => {
    expect(checkExpiry(makePayload()).status).toBe("active");
  });

  it("returns expired for a past token", () => {
    const p = makePayload({ expires_at: Math.floor(Date.now() / 1000) - 3600 });
    const result = checkExpiry(p);
    expect(result.status).toBe("expired");
    expect(result.remaining_seconds).toBe(0);
  });

  it("returns expiring_soon within 24h", () => {
    const p = makePayload({ expires_at: Math.floor(Date.now() / 1000) + 3600 });
    expect(checkExpiry(p).status).toBe("expiring_soon");
  });

  it("returns warning within 3 days", () => {
    const p = makePayload({ expires_at: Math.floor(Date.now() / 1000) + 2 * 86400 });
    expect(checkExpiry(p).status).toBe("warning");
  });
});

describe("formatDuration", () => {
  it("formats days and hours", () => {
    expect(formatDuration(2 * 86400 + 5 * 3600)).toBe("2d 5h");
  });
  it("formats hours only", () => {
    expect(formatDuration(3 * 3600)).toBe("3h");
  });
  it("returns Expired for zero or negative", () => {
    expect(formatDuration(0)).toBe("Expired");
    expect(formatDuration(-100)).toBe("Expired");
  });
});

describe("needsRotation", () => {
  it("false for active", () => {
    expect(needsRotation(makePayload())).toBe(false);
  });
  it("true for expired", () => {
    expect(needsRotation(makePayload({ expires_at: Math.floor(Date.now() / 1000) - 1 }))).toBe(true);
  });
});

describe("PLATFORM_THRESHOLDS", () => {
  it("has the four platform minimums", () => {
    expect(PLATFORM_THRESHOLDS.youtube).toBe(10000);
    expect(PLATFORM_THRESHOLDS.tiktok).toBe(10000);
    expect(PLATFORM_THRESHOLDS.instagram).toBe(10000);
    expect(PLATFORM_THRESHOLDS.twitter).toBe(10000);
  });
});
