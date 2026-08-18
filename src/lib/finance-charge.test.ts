import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createDestinationChargeForConversion,
  markChargeFailed,
  releaseConversion,
} from "@/lib/finance";

type Row = Record<string, unknown>;

const { mockClient, mockStripe } = vi.hoisted(() => ({
  mockClient: { current: null as unknown },
  mockStripe: { current: null as unknown },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => mockClient.current,
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: () => mockStripe.current,
  calculateCreatorCut: (n: number) => Math.round(n * 0.9 * 100) / 100,
}));

interface FakeSupabaseConfig {
  singles?: Record<string, Row | null>;
  updateSelectData?: unknown[];
}

function makeFakeSupabase(config: FakeSupabaseConfig) {
  const inserts: Array<{ table: string; payload: Row }> = [];
  const updates: Array<{ table: string; payload: Row; eqs: [string, unknown][] }> = [];

  const supabase = {
    inserts,
    updates,
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: config.singles?.[table] ?? null, error: null }),
          }),
        }),
        update: (payload: Row) => {
          const eqs: [string, unknown][] = [];
          const record = () => updates.push({ table, payload, eqs: [...eqs] });
          const chain: Record<string, unknown> = {
            then(resolve: (v: unknown) => void) {
              record();
              return resolve({ data: null, error: null });
            },
            eq: (k: string, v: unknown) => {
              eqs.push([k, v]);
              return chain;
            },
            select: () => ({
              then(resolve: (v: unknown) => void) {
                record();
                return resolve({ data: config.updateSelectData ?? [{ id: "row" }], error: null });
              },
            }),
          };
          return chain;
        },
        insert: (payload: Row | Row[]) => {
          const rows = Array.isArray(payload) ? payload : [payload];
          for (const row of rows) inserts.push({ table, payload: row });
          return {
            then(resolve: (v: unknown) => void) {
              return resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  };
  return supabase;
}

const pendingConversion: Row = {
  id: "conv_1",
  order_amount: 100,
  creator_cut: 90,
  tracking_link_id: "link_1",
  stripe_payment_intent_id: null,
  status: "pending_hold",
};

interface StripeOpts {
  defaultPaymentMethod?: string | null;
  paymentIntent?: Row | null;
  createError?: Row;
  transferError?: Row;
}

function makeStripe(opts: StripeOpts = {}) {
  const calls: Array<{ params: Row }> = [];
  const stripe = {
    calls,
    customers: {
      retrieve: async () => ({
        deleted: false,
        invoice_settings: {
          default_payment_method:
            opts.defaultPaymentMethod === undefined ? "pm_1" : opts.defaultPaymentMethod,
        },
      }),
    },
    paymentIntents: {
      create: async (params: Row) => {
        calls.push({ params });
        if (opts.createError) throw opts.createError;
        return opts.paymentIntent ?? { id: "pi_1", status: "succeeded" };
      },
    },
    transfers: {
      create: async (params: Row) => {
        calls.push({ params });
        if (opts.transferError) throw opts.transferError;
        return { id: "tr_1" };
      },
    },
  };
  return stripe;
}

const singles = {
  conversions: pendingConversion,
  tracking_links: { campaign_id: "camp_1" },
  campaigns: { business_id: "biz_1" },
  business_profiles: { stripe_customer_id: "cus_1" },
};

function setup(config: FakeSupabaseConfig = {}, stripeOpts: StripeOpts = {}) {
  const supabase = makeFakeSupabase(config);
  const stripe = makeStripe(stripeOpts);
  mockClient.current = supabase;
  mockStripe.current = stripe;
  return { supabase, stripe };
}

beforeEach(() => {
  mockClient.current = null;
  mockStripe.current = null;
});

describe("createDestinationChargeForConversion", () => {
  it("charges the explicit default payment method and stamps the PaymentIntent id", async () => {
    const { supabase, stripe } = setup({ singles });

    const ok = await createDestinationChargeForConversion("conv_1");
    expect(ok).toBe(true);

    expect(stripe.calls).toHaveLength(1);
    expect(stripe.calls[0].params).toMatchObject({
      payment_method: "pm_1",
      confirm: true,
      off_session: true,
      customer: "cus_1",
      amount: 10000,
    });

    const stamped = supabase.updates.find(
      (u) => u.table === "conversions" && u.payload.stripe_payment_intent_id === "pi_1",
    );
    expect(stamped).toBeTruthy();
    // No reversal or notification on success.
    expect(supabase.inserts).toHaveLength(0);
  });

  it("reverses the hold and notifies when there is no default payment method", async () => {
    const { supabase, stripe } = setup({ singles }, { defaultPaymentMethod: null });

    const ok = await createDestinationChargeForConversion("conv_1");
    expect(ok).toBe(false);

    // No PaymentIntent was attempted.
    expect(stripe.calls).toHaveLength(0);

    assertReversedAndNotified(supabase);
  });

  it("reverses the hold and notifies when the card is declined", async () => {
    const { supabase } = setup(
      { singles },
      { createError: { type: "StripeCardError", decline_code: "card_declined", message: "declined" } },
    );

    const ok = await createDestinationChargeForConversion("conv_1");
    expect(ok).toBe(false);

    const notification = supabase.inserts.find((i) => i.table === "notifications");
    expect(notification?.payload.body).toMatch(/Card declined \(card_declined\)/);

    assertReversedAndNotified(supabase);
  });

  it("treats requires_action (3DS) as a failed off-session charge", async () => {
    const { supabase } = setup(
      { singles },
      { paymentIntent: { id: "pi_2", status: "requires_action" } },
    );

    const ok = await createDestinationChargeForConversion("conv_1");
    expect(ok).toBe(false);
    assertReversedAndNotified(supabase);
  });

  function assertReversedAndNotified(supabase: ReturnType<typeof makeFakeSupabase>) {
    // Conversion flipped to refunded.
    const refundUpdate = supabase.updates.find(
      (u) => u.table === "conversions" && u.payload.status === "refunded",
    );
    expect(refundUpdate).toBeTruthy();

    // Hold (+90) neutralized by a -90 refund entry.
    const refundEntry = supabase.inserts.find(
      (i) => i.table === "ledger_entries" && i.payload.type === "refund",
    );
    expect(refundEntry?.payload.amount).toBe(-90);

    // Business notified.
    const notification = supabase.inserts.find((i) => i.table === "notifications");
    expect(notification?.payload.user_id).toBe("biz_1");
    expect(notification?.payload.type).toBe("payment");
  }
});

describe("markChargeFailed", () => {
  it("is a no-op when the conversion is no longer pending_hold (webhook already handled it)", async () => {
    const { supabase } = setup({
      singles: {
        conversions: { id: "conv_1", creator_cut: 90, tracking_link_id: "link_1" },
        tracking_links: { campaign_id: "camp_1" },
        campaigns: { business_id: "biz_1" },
      },
      // Simulate the race: the update matches zero rows because status already flipped.
      updateSelectData: [],
    });

    await markChargeFailed("conv_1", "test");

    // No ledger entry and no notification because the guard saw it was handled.
    expect(supabase.inserts).toHaveLength(0);
  });
});

describe("releaseConversion", () => {
  const releasedConversion: Row = {
    id: "conv_r",
    creator_cut: 90,
    platform_cut: 10,
    tracking_link_id: "link_r",
    stripe_transfer_id: null,
    status: "pending_hold",
  };

  it("creates a Stripe transfer and stamps it when the creator is connect-ready", async () => {
    const { supabase, stripe } = setup({
      singles: {
        conversions: releasedConversion,
        tracking_links: { creator_id: "creator_1" },
        creator_profiles: { stripe_account_id: "acct_1", stripe_connect_ready: true },
      },
    });

    const ok = await releaseConversion("conv_r");
    expect(ok).toBe(true);

    const transferCall = stripe.calls.find((c) => c.params.currency === "usd");
    expect(transferCall?.params).toMatchObject({ amount: 9000, destination: "acct_1" });

    const released = supabase.updates.find(
      (u) => u.table === "conversions" && u.payload.status === "released",
    );
    expect(released?.payload.stripe_transfer_id).toBe("tr_1");

    expect(supabase.inserts.some((i) => i.table === "ledger_entries" && i.payload.type === "release" && i.payload.amount === 90)).toBe(true);
    expect(supabase.inserts.some((i) => i.table === "ledger_entries" && i.payload.type === "platform_fee" && i.payload.amount === 10)).toBe(true);
  });

  it("releases without a transfer when the creator is not connect-ready", async () => {
    const { supabase, stripe } = setup({
      singles: {
        conversions: releasedConversion,
        tracking_links: { creator_id: "creator_1" },
        creator_profiles: { stripe_account_id: "acct_1", stripe_connect_ready: false },
      },
    });

    const ok = await releaseConversion("conv_r");
    expect(ok).toBe(true);

    // No transfer attempted.
    expect(stripe.calls).toHaveLength(0);

    const released = supabase.updates.find(
      (u) => u.table === "conversions" && u.payload.status === "released",
    );
    expect(released).toBeTruthy();
    expect(released?.payload.stripe_transfer_id).toBeUndefined();

    // The ledger still records the release + platform fee.
    expect(supabase.inserts.some((i) => i.table === "ledger_entries" && i.payload.type === "release")).toBe(true);
    expect(supabase.inserts.some((i) => i.table === "ledger_entries" && i.payload.type === "platform_fee")).toBe(true);
  });
});
