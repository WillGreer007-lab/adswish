import { describe, it, expect } from "vitest";
import {
  MIN_PAYOUT_DOLLARS,
  shouldPayout,
  partialRefundSplit,
} from "@/lib/finance";

describe("shouldPayout", () => {
  it("requires the $25 minimum", () => {
    expect(shouldPayout(24.99, "approved")).toBe(false);
    expect(shouldPayout(25, "approved")).toBe(true);
  });

  it("requires an approved tax form", () => {
    expect(shouldPayout(100, "not_submitted")).toBe(false);
    expect(shouldPayout(100, "submitted")).toBe(false);
    expect(shouldPayout(100, "approved")).toBe(true);
  });

  it("exposes the documented $25 threshold", () => {
    expect(MIN_PAYOUT_DOLLARS).toBe(25);
  });
});

describe("partialRefundSplit", () => {
  it("matches the blueprint example: $100, 2/3 approved", () => {
    // $100 total, 2/3 deliverables approved → creator keeps 2/3 less the 10%
    // platform fee ($60.00), business gets $33.33 refunded.
    const { creatorNetDollars, refundDollars } = partialRefundSplit(100, 2, 3);
    expect(creatorNetDollars).toBe(60);
    expect(refundDollars).toBe(33.33);
  });

  it("refunds everything when nothing is approved", () => {
    const { creatorNetDollars, refundDollars } = partialRefundSplit(100, 0, 3);
    expect(creatorNetDollars).toBe(0);
    expect(refundDollars).toBe(100);
  });

  it("refunds nothing when everything is approved", () => {
    const { creatorNetDollars, refundDollars } = partialRefundSplit(100, 3, 3);
    expect(creatorNetDollars).toBe(90);
    expect(refundDollars).toBe(0);
  });
});
