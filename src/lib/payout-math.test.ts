import { describe, it, expect } from "vitest";
import {
  calculateCreatorCut,
  calculatePlatformFee,
  escrowHoldExpiresAt,
  escrowHoldDaysForPlan,
  PLATFORM_COMMISSION_RATE,
  ESCROW_HOLD_DAYS,
} from "./payout-math";

/**
 * The money the platform actually moves: a 90/10 split with cent-precision
 * rounding, and a 7-day escrow hold. These tests pin the exact rounding
 * behavior so the ledger never drifts between conversion recording and the
 * Stripe webhook restart path.
 */

describe("calculateCreatorCut", () => {
  it("takes 90% of a whole-dollar amount", () => {
    expect(calculateCreatorCut(100)).toBe(90);
  });

  it("rounds to cents (never loses cent precision)", () => {
    expect(calculateCreatorCut(33.33)).toBe(30.0); // 29.997 → 30.00
    expect(calculateCreatorCut(99.99)).toBe(89.99); // 89.991 → 89.99
    expect(calculateCreatorCut(0.01)).toBe(0.01); // 0.009 → 0.01
  });

  it("is 0 for a zero amount", () => {
    expect(calculateCreatorCut(0)).toBe(0);
  });
});

describe("calculatePlatformFee", () => {
  it("is the remainder so the split always sums to the order total", () => {
    const amounts = [100, 99.99, 33.33, 0.01, 1234.56, 7, 250.5];
    for (const amount of amounts) {
      const creatorCut = calculateCreatorCut(amount);
      const platformCut = calculatePlatformFee(amount);
      expect(creatorCut + platformCut).toBeCloseTo(amount, 10);
      expect(platformCut).toBe(Math.round((amount - creatorCut) * 100) / 100);
    }
  });

  it("is the configured 10% rate (subject to cent rounding)", () => {
    expect(PLATFORM_COMMISSION_RATE).toBe(0.1);
    expect(calculatePlatformFee(100)).toBe(10);
  });
});

describe("escrowHoldExpiresAt", () => {
  const now = Date.UTC(2026, 7, 19, 12, 0, 0); // 2026-08-19T12:00:00Z

  it("is exactly 7 days after the reference time", () => {
    const expires = new Date(escrowHoldExpiresAt(now)).getTime();
    expect(expires - now).toBe(ESCROW_HOLD_DAYS * 24 * 60 * 60 * 1000);
    expect(new Date(expires).toISOString()).toBe("2026-08-26T12:00:00.000Z");
  });

  it("returns a UTC ISO string", () => {
    expect(escrowHoldExpiresAt(now)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("defaults to now when no reference is given", () => {
    const before = Date.now();
    const expires = new Date(escrowHoldExpiresAt()).getTime();
    const after = Date.now();
    expect(expires - ESCROW_HOLD_DAYS * 24 * 60 * 60 * 1000).toBeGreaterThanOrEqual(before);
    expect(expires - ESCROW_HOLD_DAYS * 24 * 60 * 60 * 1000).toBeLessThanOrEqual(after);
  });

  it("honors an explicit days override (plan-based holds)", () => {
    expect(new Date(escrowHoldExpiresAt(now, 5)).getTime() - now).toBe(5 * 24 * 60 * 60 * 1000);
    expect(new Date(escrowHoldExpiresAt(now, 3)).getTime() - now).toBe(3 * 24 * 60 * 60 * 1000);
  });
});

describe("escrowHoldDaysForPlan", () => {
  it("maps creator plans to 7/5/3 days", () => {
    expect(escrowHoldDaysForPlan("creator_free")).toBe(7);
    expect(escrowHoldDaysForPlan("creator_pro")).toBe(5);
    expect(escrowHoldDaysForPlan("creator_premium")).toBe(3);
  });

  it("falls back to 7 days for unknown or missing plans", () => {
    expect(escrowHoldDaysForPlan("business_growth")).toBe(7);
    expect(escrowHoldDaysForPlan(null)).toBe(7);
    expect(escrowHoldDaysForPlan(undefined)).toBe(7);
  });
});
