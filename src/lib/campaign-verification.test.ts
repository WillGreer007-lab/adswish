import { describe, it, expect } from "vitest";
import {
  computeCampaignStatus,
  checkThreshold,
  buildLockBanner,
  validatePlatformSelection,
} from "@/lib/campaign-verification";
import type { SocialPlatform } from "@/lib/verification-token";

describe("computeCampaignStatus", () => {
  it("stays draft if current status is draft", () => {
    const result = computeCampaignStatus("draft", ["youtube"], []);
    expect(result).toBe("draft");
  });

  it("stays verified if current status is verified", () => {
    const result = computeCampaignStatus("verified", ["youtube"], []);
    expect(result).toBe("verified");
  });

  it("returns pending_verification when all platforms verified", () => {
    const result = computeCampaignStatus("locked", ["youtube"], [
      { platform: "youtube", status: "verified", follower_count: 5000, threshold_met: true, token_posted: true },
    ]);
    expect(result).toBe("pending_verification");
  });

  it("returns locked when some platforms unverified", () => {
    const result = computeCampaignStatus("pending_verification", ["youtube", "instagram"], [
      { platform: "youtube", status: "verified", follower_count: 5000, threshold_met: true, token_posted: true },
      { platform: "instagram", status: "pending", follower_count: 0, threshold_met: false, token_posted: false },
    ]);
    expect(result).toBe("locked");
  });

  it("returns pending_verification when no platforms selected", () => {
    const result = computeCampaignStatus("locked", [], []);
    expect(result).toBe("pending_verification");
  });
});

describe("checkThreshold", () => {
  it("returns true when above threshold", () => {
    expect(checkThreshold("youtube", 1000)).toBe(true);
    expect(checkThreshold("youtube", 5000)).toBe(true);
    expect(checkThreshold("tiktok", 5000)).toBe(true);
    expect(checkThreshold("instagram", 3000)).toBe(true);
    expect(checkThreshold("twitter", 2500)).toBe(true);
  });

  it("returns false when below threshold", () => {
    expect(checkThreshold("youtube", 999)).toBe(false);
    expect(checkThreshold("tiktok", 4999)).toBe(false);
    expect(checkThreshold("instagram", 2999)).toBe(false);
    expect(checkThreshold("twitter", 2499)).toBe(false);
  });
});

describe("buildLockBanner", () => {
  it("returns not locked when all verified", () => {
    const result = buildLockBanner(["youtube"], [
      { platform: "youtube", status: "verified", follower_count: 5000, threshold_met: true, token_posted: true },
    ]);
    expect(result.locked).toBe(false);
    expect(result.unverified).toEqual([]);
  });

  it("returns locked with unverified platforms", () => {
    const result = buildLockBanner(["youtube", "instagram"], [
      { platform: "youtube", status: "verified", follower_count: 5000, threshold_met: true, token_posted: true },
    ]);
    expect(result.locked).toBe(true);
    expect(result.unverified).toContain("instagram");
    expect(result.message).toContain("1 pending");
  });
});

describe("validatePlatformSelection", () => {
  it("accepts valid platforms", () => {
    const result = validatePlatformSelection(["youtube", "tiktok", "instagram", "twitter"]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects unknown platforms", () => {
    const result = validatePlatformSelection(["youtube", "facebook"]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Unknown platform");
  });

  it("rejects duplicates", () => {
    const result = validatePlatformSelection(["youtube", "youtube"]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Duplicate");
  });
});
