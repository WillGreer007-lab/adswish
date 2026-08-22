import { describe, it, expect } from "vitest";
import {
  getCreatorTier,
  canApplyToCampaignType,
  getMaxActiveCampaigns,
  TIER_LIMITS,
} from "@/lib/tier";

describe("Creator tier assignment", () => {
  it("returns null for under 10,000 followers", () => {
    expect(getCreatorTier(0)).toBeNull();
    expect(getCreatorTier(5000)).toBeNull();
    expect(getCreatorTier(9999)).toBeNull();
  });

  it("assigns Micro tier for 10,000-99,999 followers", () => {
    expect(getCreatorTier(10000)).toBe("micro");
    expect(getCreatorTier(50000)).toBe("micro");
    expect(getCreatorTier(99999)).toBe("micro");
  });

  it("assigns Mid tier for 100,000-999,999 followers", () => {
    expect(getCreatorTier(100000)).toBe("mid");
    expect(getCreatorTier(500000)).toBe("mid");
    expect(getCreatorTier(999999)).toBe("mid");
  });

  it("assigns Macro tier for 1,000,000+ followers", () => {
    expect(getCreatorTier(1000000)).toBe("macro");
    expect(getCreatorTier(5000000)).toBe("macro");
    expect(getCreatorTier(10000000)).toBe("macro");
  });
});

describe("Campaign type access by tier", () => {
  it("Micro tier can only apply to Fixed campaigns", () => {
    expect(canApplyToCampaignType("micro", "fixed")).toBe(true);
    expect(canApplyToCampaignType("micro", "affiliate")).toBe(false);
    expect(canApplyToCampaignType("micro", "hybrid")).toBe(false);
  });

  it("Mid tier can apply to Fixed and Hybrid campaigns", () => {
    expect(canApplyToCampaignType("mid", "fixed")).toBe(true);
    expect(canApplyToCampaignType("mid", "hybrid")).toBe(true);
    expect(canApplyToCampaignType("mid", "affiliate")).toBe(false);
  });

  it("Macro tier can apply to all campaign types", () => {
    expect(canApplyToCampaignType("macro", "fixed")).toBe(true);
    expect(canApplyToCampaignType("macro", "affiliate")).toBe(true);
    expect(canApplyToCampaignType("macro", "hybrid")).toBe(true);
  });
});

describe("Active campaign limits by tier", () => {
  it("Micro tier limited to 2 active campaigns", () => {
    expect(getMaxActiveCampaigns("micro")).toBe(2);
  });

  it("Mid tier limited to 5 active campaigns", () => {
    expect(getMaxActiveCampaigns("mid")).toBe(5);
  });

  it("Macro tier has unlimited campaigns", () => {
    expect(getMaxActiveCampaigns("macro")).toBe(Infinity);
  });
});

describe("Tier limits object integrity", () => {
  it("has correct campaign types per tier", () => {
    expect(TIER_LIMITS.micro.campaignTypes).toEqual(["fixed"]);
    expect(TIER_LIMITS.mid.campaignTypes).toEqual(["fixed", "hybrid"]);
    expect(TIER_LIMITS.macro.campaignTypes).toEqual(["fixed", "affiliate", "hybrid"]);
  });
});
