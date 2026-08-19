import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  releaseExpiredHolds,
  applyRefund,
  applyChargeback,
  recordWebhookEvent,
} from "@/lib/finance";
import { handleStripeEvent } from "@/lib/stripe-webhooks";

/**
 * Self-contained lifecycle test. No real Stripe, no real Supabase — an
 * in-memory database + a fake Stripe client drive the full release-holds cron
 * path and the refund/chargeback webhook handlers:
 *
 *   charge (recorded hold +90) → hold expiry → release (+90 release,
 *   +10 platform fee, Stripe transfer attempt) → refund (idempotent −90) →
 *   chargeback (idempotent −90 clawback).
 *
 * The invariant asserted everywhere: the ledger always nets the creator's cut
 * to zero across the whole lifecycle — the platform never creates or destroys
 * money.
 */

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
  getStripeCurrency: () => (process.env.STRIPE_CURRENCY ?? "usd").toLowerCase(),
  calculateCreatorCut: (n: number) => Math.round(n * 0.9 * 100) / 100,
}));

/** Minimal in-memory table store with the query surface finance.ts uses. */
class MemDB {
  tables: Record<string, Row[]> = {};

  seed(table: string, rows: Row[]) {
    this.tables[table] = rows.map((r) => ({ ...r }));
  }

  all(table: string): Row[] {
    return this.tables[table] ?? [];
  }

  from(table: string) {
    const db = this;
    return {
      select: () => ({
        eq: (k: string, v: unknown) => ({
          lte: (k2: string, v2: unknown) => ({
            then: (resolve: (v: unknown) => void) => {
              resolve({ data: db.all(table).filter((r) => r[k] === v && (r[k2] as string) <= (v2 as string)), error: null });
            },
          }),
          maybeSingle: async () => {
            const hit = db.all(table).find((r) => r[k] === v);
            return { data: hit ?? null, error: null };
          },
          single: async () => {
            const hit = db.all(table).find((r) => r[k] === v);
            return { data: hit ?? null, error: null };
          },
        }),
        maybeSingle: async () => ({ data: null, error: null }),
      }),
      update: (payload: Row) => ({
        eq: (k: string, v: unknown) => ({
          select: async () => {
            for (const row of db.all(table)) {
              if (row[k] === v) Object.assign(row, payload);
            }
            return { data: db.all(table).filter((r) => r[k] === v), error: null };
          },
          then: (resolve: (v: unknown) => void) => {
            const matched = db.all(table).filter((r) => r[k] === v);
            for (const row of matched) Object.assign(row, payload);
            resolve({ data: null, error: null });
          },
        }),
      }),
      insert: (payload: Row | Row[]) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        db.tables[table] = db.tables[table] ?? [];
        let violation = false;
        for (const row of rows) {
          // webhook_events.event_id is a PK — mimic the unique violation.
          if (table === "webhook_events" && db.tables[table].some((r) => r.event_id === row.event_id)) {
            violation = true;
            continue;
          }
          db.tables[table].push({ id: `row_${db.tables[table].length}`, ...row });
        }
        const result = violation ? { data: null, error: { code: "23505" } } : { data: null, error: null };
        return {
          then: (resolve: (v: unknown) => void) => resolve(result),
          select: async () => {
            const last = db.tables[table][db.tables[table].length - 1];
            return { data: last, error: null };
          },
          single: async () => {
            const last = db.tables[table][db.tables[table].length - 1];
            return { data: last, error: null };
          },
        };
      },
    };
  }
}

/** Fake Stripe that records transfer attempts. */
function makeStripe() {
  const calls: Array<{ amount: number; currency: string; destination: string }> = [];
  return {
    calls,
    transfers: {
      create: async (params: { amount: number; currency: string; destination: string }) => {
        calls.push({ ...params });
        return { id: `tr_${calls.length}` };
      },
    },
  };
}

let db: MemDB;
let stripe: ReturnType<typeof makeStripe>;

beforeEach(() => {
  db = new MemDB();
  stripe = makeStripe();
  mockClient.current = db;
  mockStripe.current = stripe;
});

function ledger(conversionId: string) {
  return db
    .all("ledger_entries")
    .filter((e) => e.related_conversion_id === conversionId)
    .map((e) => ({ type: e.type as string, amount: e.amount as number }));
}

function net(conversionId: string): number {
  return ledger(conversionId).reduce((sum, e) => sum + e.amount, 0);
}

describe("release-holds cron against an in-memory ledger", () => {
  it("releases only expired pending_hold conversions and transfers the creator's 90%", async () => {
    const expired = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.seed("conversions", [
      { id: "c_expired", creator_cut: 90, platform_cut: 10, tracking_link_id: "l1", stripe_transfer_id: null, status: "pending_hold", hold_expires_at: expired },
      { id: "c_future", creator_cut: 45, platform_cut: 5, tracking_link_id: "l2", stripe_transfer_id: null, status: "pending_hold", hold_expires_at: future },
      { id: "c_already", creator_cut: 90, platform_cut: 10, tracking_link_id: "l3", stripe_transfer_id: null, status: "released", hold_expires_at: expired },
    ]);
    db.seed("tracking_links", [
      { id: "l1", creator_id: "creator_1" },
      { id: "l2", creator_id: "creator_1" },
      { id: "l3", creator_id: "creator_1" },
    ]);
    db.seed("creator_profiles", [
      { user_id: "creator_1", stripe_account_id: "acct_1", stripe_connect_ready: true },
    ]);

    const released = await releaseExpiredHolds();

    // Only c_expired was pending + expired.
    expect(released).toBe(1);
    expect(db.all("conversions").find((c) => c.id === "c_expired")?.status).toBe("released");
    expect(db.all("conversions").find((c) => c.id === "c_future")?.status).toBe("pending_hold");
    expect(db.all("conversions").find((c) => c.id === "c_already")?.status).toBe("released");

    // Transfer attempted for the full creator cut in cents.
    expect(stripe.calls).toHaveLength(1);
    expect(stripe.calls[0]).toMatchObject({ amount: 9000, destination: "acct_1" });

    // Ledger: +90 release, +10 platform fee — creator nets zero on the hold side.
    expect(ledger("c_expired")).toEqual(
      expect.arrayContaining([
        { type: "release", amount: 90 },
        { type: "platform_fee", amount: 10 },
      ]),
    );
    expect(ledger("c_future")).toHaveLength(0);
  });

  it("releases without a transfer when the creator is not connect-ready, ledger still correct", async () => {
    const expired = new Date(Date.now() - 60_000).toISOString();
    db.seed("conversions", [
      { id: "c1", creator_cut: 90, platform_cut: 10, tracking_link_id: "l1", stripe_transfer_id: null, status: "pending_hold", hold_expires_at: expired },
    ]);
    db.seed("tracking_links", [{ id: "l1", creator_id: "creator_1" }]);
    db.seed("creator_profiles", [
      { user_id: "creator_1", stripe_account_id: "acct_1", stripe_connect_ready: false },
    ]);

    const released = await releaseExpiredHolds();
    expect(released).toBe(1);
    expect(stripe.calls).toHaveLength(0); // no transfer attempted
    expect(ledger("c1")).toEqual(
      expect.arrayContaining([
        { type: "release", amount: 90 },
        { type: "platform_fee", amount: 10 },
      ]),
    );
  });

  it("is idempotent — a second run releases nothing new", async () => {
    const expired = new Date(Date.now() - 60_000).toISOString();
    db.seed("conversions", [
      { id: "c1", creator_cut: 90, platform_cut: 10, tracking_link_id: "l1", stripe_transfer_id: null, status: "pending_hold", hold_expires_at: expired },
    ]);
    db.seed("tracking_links", [{ id: "l1", creator_id: "creator_1" }]);
    db.seed("creator_profiles", [
      { user_id: "creator_1", stripe_account_id: "acct_1", stripe_connect_ready: true },
    ]);

    await releaseExpiredHolds();
    const second = await releaseExpiredHolds();

    expect(second).toBe(0);
    // One transfer, one release entry — nothing double-counted.
    expect(stripe.calls).toHaveLength(1);
    expect(ledger("c1").filter((e) => e.type === "release")).toHaveLength(1);
  });
});

describe("full lifecycle: charge → release → refund → chargeback", () => {
  function seedHeldConversion(id: string) {
    db.seed("conversions", [
      { id, order_amount: 100, creator_cut: 90, platform_cut: 10, tracking_link_id: "l1", stripe_transfer_id: null, status: "pending_hold", hold_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
    ]);
    db.seed("tracking_links", [{ id: "l1", creator_id: "creator_1" }]);
    db.seed("creator_profiles", [
      { user_id: "creator_1", stripe_account_id: "acct_1", stripe_connect_ready: true },
    ]);
  }

  it("nets the creator's cut to zero through the full webhook lifecycle, with route-level dedup", async () => {
    // ── Refund path ──────────────────────────────────────────────────────────
    seedHeldConversion("c_refund");
    db.all("conversions").find((c) => c.id === "c_refund")!.stripe_payment_intent_id = "pi_refund";
    db.tables.ledger_entries = [
      { related_conversion_id: "c_refund", type: "hold", amount: 90 },
    ];

    // Route: recordWebhookEvent first (dedup), then handleStripeEvent.
    const refundEvent = {
      id: "evt_refund_1",
      type: "charge.refunded",
      data: { object: { payment_intent: "pi_refund", amount_refunded: 10000, amount: 10000 } },
    } as never;
    expect(await recordWebhookEvent("evt_refund_1", "stripe", {})).toBe(true);
    await handleStripeEvent(refundEvent, db as never);

    const refundEntries = ledger("c_refund").filter((e) => e.type === "refund");
    expect(refundEntries).toEqual([{ type: "refund", amount: -90 }]);
    expect(db.all("conversions").find((c) => c.id === "c_refund")?.status).toBe("refunded");

    // Stripe redelivers the SAME event id → dedup at the route, no double entry.
    expect(await recordWebhookEvent("evt_refund_1", "stripe", {})).toBe(false);
    expect(ledger("c_refund").filter((e) => e.type === "refund")).toHaveLength(1);
    expect(net("c_refund")).toBe(0); // hold +90, refund -90

    // ── Chargeback path ──────────────────────────────────────────────────────
    seedHeldConversion("c_cb");
    db.all("conversions").find((c) => c.id === "c_cb")!.stripe_payment_intent_id = "pi_cb";
    db.tables.ledger_entries = [
      { related_conversion_id: "c_cb", type: "hold", amount: 90 },
    ];

    const cbEvent = {
      id: "evt_dispute_1",
      type: "charge.dispute.closed",
      data: { object: { status: "lost", payment_intent: "pi_cb", amount: 10000 } },
    } as never;
    expect(await recordWebhookEvent("evt_dispute_1", "stripe", {})).toBe(true);
    await handleStripeEvent(cbEvent, db as never);

    const clawbacks = ledger("c_cb").filter((e) => e.type === "chargeback_clawback");
    expect(clawbacks).toEqual([{ type: "chargeback_clawback", amount: -90 }]);
    expect(db.all("conversions").find((c) => c.id === "c_cb")?.status).toBe("chargeback");

    // Redelivered → dedup, still exactly one clawback.
    expect(await recordWebhookEvent("evt_dispute_1", "stripe", {})).toBe(false);
    expect(ledger("c_cb").filter((e) => e.type === "chargeback_clawback")).toHaveLength(1);
    expect(net("c_cb")).toBe(0); // hold +90, clawback -90
  });

  it("handles a partial refund proportionally (half the order → half the hold)", async () => {
    db.seed("conversions", [
      { id: "c_partial", order_amount: 100, creator_cut: 90, platform_cut: 10, tracking_link_id: "l1", stripe_transfer_id: null, status: "pending_hold", hold_expires_at: null },
    ]);
    db.seed("tracking_links", [{ id: "l1", creator_id: "creator_1" }]);
    db.seed("creator_profiles", [
      { user_id: "creator_1", stripe_account_id: "acct_1", stripe_connect_ready: true },
    ]);
    db.tables.ledger_entries = [
      { related_conversion_id: "c_partial", type: "hold", amount: 90 },
    ];

    // $100 order, $50 refunded → creator refund = 90 * 0.5 = 45, status stays pending_hold.
    expect(await applyRefund("c_partial", 50)).toBe(true);
    const refunds = ledger("c_partial").filter((e) => e.type === "refund");
    expect(refunds).toEqual([{ type: "refund", amount: -45 }]);
    expect(db.all("conversions").find((c) => c.id === "c_partial")?.status).toBe("pending_hold");
    expect(net("c_partial")).toBe(45); // remaining hold stays on the books
  });
});
