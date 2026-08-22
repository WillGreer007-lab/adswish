import { describe, it, expect } from "vitest";
import { tierForFollowers, TIER_THRESHOLDS } from "./follower-recheck";

describe("tierForFollowers", () => {
  it("returns null below the micro minimum", () => {
    expect(tierForFollowers(0)).toBeNull();
    expect(tierForFollowers(9_999)).toBeNull();
  });

  it("returns micro for 10K–99.9K", () => {
    expect(tierForFollowers(TIER_THRESHOLDS.minMicro)).toBe("micro");
    expect(tierForFollowers(99_999)).toBe("micro");
  });

  it("returns mid for 100K–999.9K", () => {
    expect(tierForFollowers(TIER_THRESHOLDS.minMid)).toBe("mid");
    expect(tierForFollowers(999_999)).toBe("mid");
  });

  it("returns macro for 1M+", () => {
    expect(tierForFollowers(TIER_THRESHOLDS.minMacro)).toBe("macro");
    expect(tierForFollowers(5_000_000)).toBe("macro");
  });
});
