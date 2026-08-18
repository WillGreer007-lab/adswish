import { describe, it, expect } from "vitest";
import {
  calculateCreatorCut,
  calculatePlatformFee,
} from "@/lib/stripe/client";

describe("Stripe fee calculations", () => {
  it("calculates 90% creator cut on round numbers", () => {
    expect(calculateCreatorCut(100)).toBe(90);
    expect(calculatePlatformFee(100)).toBe(10);
  });

  it("calculates 90% creator cut on decimal amounts", () => {
    expect(calculateCreatorCut(49.99)).toBeCloseTo(44.99, 2);
    expect(calculatePlatformFee(49.99)).toBeCloseTo(5, 2);
  });

  it("rounds to nearest cent", () => {
    const cut = calculateCreatorCut(33.33);
    expect(cut).toBeCloseTo(30, 2);
    expect(calculatePlatformFee(33.33)).toBeCloseTo(3.33, 2);
  });

  it("handles zero", () => {
    expect(calculateCreatorCut(0)).toBe(0);
    expect(calculatePlatformFee(0)).toBe(0);
  });
});
