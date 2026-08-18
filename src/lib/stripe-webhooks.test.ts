import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleStripeEvent,
  syncSubscription,
  mapSubscriptionStatus,
} from "@/lib/stripe-webhooks";

const { applyRefund, applyChargeback } = vi.hoisted(() => ({
  applyRefund: vi.fn().mockResolvedValue(true),
  applyChargeback: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/finance", () => ({
  applyRefund,
  applyChargeback,
}));

type Row = Record<string, unknown>;

function makeFakeSupabase(selects: Record<string, Row | Row[] | null> = {}) {
  const inserted: Record<string, Row[]> = {};
  const updated: Record<string, Array<{ payload: Row; key: string; value: unknown }>> = {};

  const thenable = {
    then(resolve: (v: unknown) => void) {
      return resolve({ error: null });
    },
  };

  const supabase = {
    inserted,
    updated,
    from(table: string) {
      const builder: {
        select: (cols?: string) => { eq: (k: string, v: unknown) => { single: () => Promise<{ data: unknown; error: null }> } };
        update: (payload: Row) => typeof thenable & { eq: (k: string, v: unknown) => typeof thenable };
        insert: (payload: Row | Row[]) => PromiseLike<{ error: null }>;
      } = {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: selects[table] ?? null, error: null }),
          }),
        }),
        update: (payload: Row) => {
          const t = { ...thenable } as typeof thenable & { eq: (k: string, v: unknown) => typeof thenable };
          t.eq = (k: string, v: unknown) => {
            updated[table] = [...(updated[table] ?? []), { payload, key: k, value: v }];
            return thenable;
          };
          return t;
        },
        insert: (payload: Row | Row[]) => {
          const rows = Array.isArray(payload) ? payload : [payload];
          inserted[table] = [...(inserted[table] ?? []), ...rows];
          return Promise.resolve({ error: null });
        },
      };
      return builder as never;
    },
  };
  return supabase;
}

const event = (type: string, object: unknown) =>
  ({ id: `evt_${type}_${Math.random()}`, type, data: { object } }) as never;

describe("mapSubscriptionStatus", () => {
  it("maps Stripe statuses to the app enum", () => {
    expect(mapSubscriptionStatus("active")).toBe("active");
    expect(mapSubscriptionStatus("trialing")).toBe("trialing");
    expect(mapSubscriptionStatus("past_due")).toBe("past_due");
    expect(mapSubscriptionStatus("unpaid")).toBe("past_due");
    expect(mapSubscriptionStatus("canceled")).toBe("canceled");
    expect(mapSubscriptionStatus("incomplete_expired")).toBe("canceled");
  });
});

describe("syncSubscription", () => {
  const sub = {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    current_period_start: 1_700_000_000,
    current_period_end: 1_702_000_000,
    metadata: { user_id: "user-1", role: "business", plan_slug: "business_growth" },
  };

  it("inserts a new subscription row", async () => {
    const supabase = makeFakeSupabase();
    await syncSubscription(sub as never, supabase as never);
    expect(supabase.inserted.business_subscriptions).toHaveLength(1);
    expect(supabase.inserted.business_subscriptions[0].plan_slug).toBe("business_growth");
    expect(supabase.inserted.business_subscriptions[0].status).toBe("active");
    expect(supabase.inserted.business_subscriptions[0].business_id).toBe("user-1");
  });

  it("updates an existing subscription by stripe_subscription_id", async () => {
    const supabase = makeFakeSupabase({ business_subscriptions: { id: "row-1" } });
    await syncSubscription(sub as never, supabase as never);
    expect(supabase.updated.business_subscriptions).toHaveLength(1);
    expect(supabase.updated.business_subscriptions[0].payload.status).toBe("active");
    expect(supabase.updated.business_subscriptions[0].value).toBe("row-1");
  });

  it("marks a canceled subscription canceled with a timestamp", async () => {
    const supabase = makeFakeSupabase();
    const canceled = {
      ...sub,
      status: "canceled",
      canceled_at: 1_701_000_000,
    };
    await syncSubscription(canceled as never, supabase as never);
    const row = supabase.inserted.business_subscriptions[0];
    expect(row.status).toBe("canceled");
    expect(row.canceled_at).toBeTruthy();
  });
});

describe("handleStripeEvent", () => {
  beforeEach(() => {
    applyRefund.mockClear();
    applyChargeback.mockClear();
  });

  it("sets stripe_account_id + connect ready on account.updated", async () => {
    const supabase = makeFakeSupabase();
    await handleStripeEvent(
      event("account.updated", {
        id: "acct_1",
        charges_enabled: true,
        details_submitted: true,
        metadata: { user_id: "creator-1" },
      }),
      supabase as never,
    );
    expect(supabase.updated.creator_profiles[0].payload).toEqual({
      stripe_account_id: "acct_1",
      stripe_connect_ready: true,
    });
    expect(supabase.updated.creator_profiles[0].value).toBe("creator-1");
  });

  it("delegates refunds to applyRefund when a conversion matches the payment intent", async () => {
    const supabase = makeFakeSupabase({ conversions: { id: "conv-1", order_amount: 10 } });
    await handleStripeEvent(
      event("charge.refunded", { payment_intent: "pi_1", amount_refunded: 1000 }),
      supabase as never,
    );
    expect(applyRefund).toHaveBeenCalledWith("conv-1", 10);
  });

  it("delegates a lost dispute to applyChargeback", async () => {
    const supabase = makeFakeSupabase({ conversions: { id: "conv-2", order_amount: 25 } });
    await handleStripeEvent(
      event("charge.dispute.closed", { status: "lost", payment_intent: "pi_2", amount: 2500 }),
      supabase as never,
    );
    expect(applyChargeback).toHaveBeenCalledWith("conv-2", 25);
  });

  it("ignores a dispute that was won", async () => {
    const supabase = makeFakeSupabase();
    await handleStripeEvent(
      event("charge.dispute.closed", { status: "won", payment_intent: "pi_2", amount: 2500 }),
      supabase as never,
    );
    expect(applyChargeback).not.toHaveBeenCalled();
  });

  it("re-holds a conversion on transfer.failed", async () => {
    const supabase = makeFakeSupabase({ conversions: { id: "conv-3" } });
    await handleStripeEvent(event("transfer.failed", { id: "tr_1" }), supabase as never);
    expect(supabase.updated.conversions[0].payload.status).toBe("pending_hold");
    expect(supabase.updated.conversions[0].value).toBe("conv-3");
  });
});
