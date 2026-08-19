import { describe, it, expect } from "vitest";
import { evaluateFreePlanCampaignLimit, FREE_PLAN_MONTHLY_LIMIT } from "./campaign-limits";

/**
 * Tests for the free-plan campaign creation limit (3 active campaigns/month).
 *
 * The edge cases here come from a real production bug found 2026-08-19: the
 * business's counter (`campaigns_created_this_month`) was stuck at 3 from test
 * runs even though no campaigns existed, blocking real campaign creation with
 * "Free plan limit reached". The counter semantics — month-scoped, stale months
 * reset to 0 — are what the route relies on, and what these tests pin down.
 */

const M = "2026-08";

describe("evaluateFreePlanCampaignLimit", () => {
  it("allows the first campaign of the month and increments the counter", () => {
    const res = evaluateFreePlanCampaignLimit(
      { campaigns_created_this_month: 0, campaigns_created_month: M },
      M,
    );
    expect(res.allowed).toBe(true);
    if (!res.allowed) return;
    expect(res.used).toBe(0);
    expect(res.remaining).toBe(2);
    expect(res.next).toEqual({ campaigns_created_this_month: 1, campaigns_created_month: M });
  });

  it("allows up to the monthly limit, then blocks", () => {
    let state = { campaigns_created_this_month: 0, campaigns_created_month: M };
    for (let i = 1; i <= FREE_PLAN_MONTHLY_LIMIT; i++) {
      const res = evaluateFreePlanCampaignLimit(state, M);
      expect(res.allowed).toBe(true);
      if (!res.allowed) break;
      state = res.next;
    }
    const blocked = evaluateFreePlanCampaignLimit(state, M);
    expect(blocked.allowed).toBe(false);
    if (blocked.allowed) return;
    expect(blocked.used).toBe(FREE_PLAN_MONTHLY_LIMIT);
    expect(blocked.remaining).toBe(0);
  });

  it("blocks when the counter is already at the limit", () => {
    const res = evaluateFreePlanCampaignLimit(
      { campaigns_created_this_month: 3, campaigns_created_month: M },
      M,
    );
    expect(res.allowed).toBe(false);
  });

  it("resets a stale counter from a previous month", () => {
    // Counter belongs to last month, but we're in a new month → resets to 0.
    const res = evaluateFreePlanCampaignLimit(
      { campaigns_created_this_month: 3, campaigns_created_month: "2026-07" },
      M,
    );
    expect(res.allowed).toBe(true);
    if (!res.allowed) return;
    expect(res.used).toBe(0);
    expect(res.next.campaigns_created_this_month).toBe(1);
    expect(res.next.campaigns_created_month).toBe(M);
  });

  it("treats a null month (never created before) as zero used", () => {
    const res = evaluateFreePlanCampaignLimit(
      { campaigns_created_this_month: 0, campaigns_created_month: null },
      M,
    );
    expect(res.allowed).toBe(true);
    if (!res.allowed) return;
    expect(res.used).toBe(0);
    expect(res.next).toEqual({ campaigns_created_this_month: 1, campaigns_created_month: M });
  });

  it("honors a custom limit", () => {
    const res = evaluateFreePlanCampaignLimit(
      { campaigns_created_this_month: 2, campaigns_created_month: M },
      M,
      2,
    );
    expect(res.allowed).toBe(false);

    const res2 = evaluateFreePlanCampaignLimit(
      { campaigns_created_this_month: 1, campaigns_created_month: M },
      M,
      2,
    );
    expect(res2.allowed).toBe(true);
    if (!res2.allowed) return;
    expect(res2.remaining).toBe(0);
    expect(res2.next.campaigns_created_this_month).toBe(2);
  });

  it("a counter higher than the limit still blocks (clamped used)", () => {
    // Defensive: a corrupted counter (e.g. leftover from deleted campaigns)
    // must never allow more than the limit.
    const res = evaluateFreePlanCampaignLimit(
      { campaigns_created_this_month: 99, campaigns_created_month: M },
      M,
    );
    expect(res.allowed).toBe(false);
  });
});
