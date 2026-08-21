import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  cancelPlanForAccount,
  resumePlanForAccount,
} from "@/lib/admin/account-actions";

/**
 * Full cancel/resume-plan flow against an in-memory DB and a fake Stripe
 * client: the local subscription row flips status, and — only when the admin
 * confirmed it — the Stripe subscription is canceled/reactivated.
 */

const { mockStripe } = vi.hoisted(() => ({
  mockStripe: { current: null as unknown },
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: () => mockStripe.current,
}));

type Row = Record<string, unknown>;

class MemDB {
  rows: Record<string, Row[]> = {};

  seed(table: string, data: Row[]) {
    this.rows[table] = data.map((r) => ({ ...r }));
  }

  from(table: string) {
    const store = this.rows;
    return {
      select: () => ({
        eq: (k: string, v: unknown) => ({
          maybeSingle: async () => {
            // Return a snapshot (Supabase deserialises each query) so a later
            // update can't mutate the previously-read row by reference.
            const hit = (store[table] ?? []).find((r) => r[k] === v);
            return { data: hit ? { ...hit } : null, error: null };
          },
        }),
      }),
      update: (payload: Row) => ({
        eq: (k: string, v: unknown) => {
          for (const r of store[table] ?? []) {
            if (r[k] === v) Object.assign(r, payload);
          }
          return {
            then: (resolve: (x: unknown) => void) => resolve({ data: null, error: null }),
          };
        },
      }),
    };
  }
}

let db: MemDB;
let cancelCalls: string[];
let updateCalls: Array<{ id: string; params: unknown }>;

beforeEach(() => {
  db = new MemDB();
  cancelCalls = [];
  updateCalls = [];
  mockStripe.current = {
    subscriptions: {
      cancel: async (id: string) => {
        cancelCalls.push(id);
        return { id };
      },
      update: async (id: string, params: unknown) => {
        updateCalls.push({ id, params });
        return { id };
      },
    },
  };
});

describe("cancelPlanForAccount", () => {
  it("cancels locally and cancels the Stripe subscription when confirmed", async () => {
    db.seed("business_subscriptions", [
      { business_id: "biz_1", plan_slug: "business_growth", status: "active", stripe_subscription_id: "sub_123" },
    ]);

    const result = await cancelPlanForAccount(db as never, "business", "biz_1", true);

    expect(result).toMatchObject({
      stripeCanceled: true,
      previousPlan: "business_growth",
      previousStatus: "active",
    });
    expect(cancelCalls).toEqual(["sub_123"]);

    const row = db.rows.business_subscriptions[0];
    expect(row.status).toBe("canceled");
    expect(row.canceled_at).toBeTruthy();
  });

  it("does not touch Stripe when the admin did not confirm", async () => {
    db.seed("business_subscriptions", [
      { business_id: "biz_1", plan_slug: "business_growth", status: "active", stripe_subscription_id: "sub_123" },
    ]);

    const result = await cancelPlanForAccount(db as never, "business", "biz_1", false);

    expect(result.stripeCanceled).toBe(false);
    expect(cancelCalls).toHaveLength(0);
    expect(db.rows.business_subscriptions[0].status).toBe("canceled");
  });
});

describe("resumePlanForAccount", () => {
  it("reactivates locally and calls Stripe update when confirmed", async () => {
    db.seed("creator_subscriptions", [
      { creator_id: "creator_1", plan_slug: "creator_pro", status: "canceled", stripe_subscription_id: "sub_456" },
    ]);

    const result = await resumePlanForAccount(db as never, "creator", "creator_1", true);

    expect(result).toMatchObject({ stripeResumed: true, planSlug: "creator_pro" });
    expect(updateCalls[0]).toMatchObject({ id: "sub_456", params: { cancel_at_period_end: false } });
    expect(db.rows.creator_subscriptions[0].status).toBe("active");
    expect(db.rows.creator_subscriptions[0].canceled_at).toBeNull();
  });
});
