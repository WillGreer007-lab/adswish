// @vitest-environment node
import { describe, it, expect } from "vitest";
import { recordConversion } from "@/lib/conversions";
import { signTrackingJwt } from "@/lib/tracking";

type Row = Record<string, unknown>;
type Supabase = ReturnType<typeof makeFakeSupabase>;

function makeFakeSupabase(opts: {
  singles?: Record<string, Row | null>;
  insertError?: string | null;
  insertId?: string;
}) {
  const inserts: Array<{ table: string; payload: Row }> = [];

  const lookup = (table: string) => {
    const q: Record<string, unknown> = {
      eq: () => q,
      then(resolve: (v: unknown) => void) {
        return resolve({ data: opts.singles?.[table] ?? null, error: null });
      },
      maybeSingle: async () => ({ data: opts.singles?.[table] ?? null, error: null }),
    };
    return q as never;
  };

  const supabase = {
    inserts,
    from(table: string) {
      return {
        select: () => lookup(table),
        insert: (payload: Row) => {
          inserts.push({ table, payload });
          const insertObj: Record<string, unknown> = {
            then(resolve: (v: unknown) => void) {
              return resolve({ data: opts.insertId ? { id: opts.insertId } : null, error: opts.insertError ? { message: opts.insertError } : null });
            },
          };
          insertObj.select = () => ({
            single: async () => ({
              data: opts.insertId ? { id: opts.insertId } : null,
              error: opts.insertError ? { message: opts.insertError } : null,
            }),
          });
          return insertObj as never;
        },
      };
    },
  };
  return supabase;
}

async function token(linkId = "link-1", jti = "jti-1") {
  return signTrackingJwt({
    linkId,
    creatorId: "creator-1",
    campaignId: "campaign-1",
    deliverableId: "deliverable-1",
    ipHash: "ip",
    uaHash: "ua",
    jti,
    ttlSeconds: 60,
  });
}

describe("recordConversion", () => {
  it("records a 90/10 split into pending_hold with a 7-day hold", async () => {
    const supabase = makeFakeSupabase({
      singles: { tracking_links: { id: "link-1", revoked_at: null } },
      insertId: "conv-1",
    });
    const result = await recordConversion(
      { token: await token(), orderId: "ORD-1", amountDollars: 100 },
      supabase as never,
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.conversionId).toBe("conv-1");

    const conv = supabase.inserts.find((i) => i.table === "conversions");
    expect(conv?.payload.creator_cut).toBe(90);
    expect(conv?.payload.platform_cut).toBe(10);
    expect(conv?.payload.status).toBe("pending_hold");
    expect(conv?.payload.hold_expires_at).toBeTruthy();

    const ledger = supabase.inserts.find((i) => i.table === "ledger_entries");
    expect(ledger?.payload.type).toBe("hold");
    expect(ledger?.payload.amount).toBe(90);
  });

  it("rounds the split to cents", async () => {
    const supabase = makeFakeSupabase({
      singles: { tracking_links: { id: "link-1", revoked_at: null } },
      insertId: "conv-2",
    });
    await recordConversion(
      { token: await token(), orderId: "ORD-2", amountDollars: 33.33 },
      supabase as never,
    );
    const conv = supabase.inserts.find((i) => i.table === "conversions");
    expect(conv?.payload.creator_cut).toBe(30); // 33.33 * 0.9 = 29.997 -> 30.00
  });

  it("410s when the jti is blocklisted", async () => {
    const supabase = makeFakeSupabase({ singles: { revoked_jtis: { jti: "jti-1" } } });
    const result = await recordConversion(
      { token: await token(), orderId: "ORD-3", amountDollars: 10 },
      supabase as never,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(410);
  });

  it("410s when the tracking link is revoked", async () => {
    const supabase = makeFakeSupabase({
      singles: { tracking_links: { id: "link-1", revoked_at: "2026-08-01T00:00:00Z" } },
    });
    const result = await recordConversion(
      { token: await token(), orderId: "ORD-4", amountDollars: 10 },
      supabase as never,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(410);
  });

  it("is idempotent on order_id (409 -> existing conversion)", async () => {
    const supabase = makeFakeSupabase({
      singles: {
        tracking_links: { id: "link-1", revoked_at: null },
        conversions: { id: "conv-existing" },
      },
    });
    const result = await recordConversion(
      { token: await token(), orderId: "ORD-5", amountDollars: 10 },
      supabase as never,
    );
    expect(result.ok).toBe(true);
    expect(result.status).toBe(409);
    expect(result.conversionId).toBe("conv-existing");
    expect(supabase.inserts.filter((i) => i.table === "conversions")).toHaveLength(0);
  });

  it("401s on an invalid token", async () => {
    const supabase = makeFakeSupabase({});
    const result = await recordConversion(
      { token: "not-a-jwt", orderId: "ORD-6", amountDollars: 10 },
      supabase as never,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  it("422s on missing/invalid input", async () => {
    const supabase = makeFakeSupabase({});
    const result = await recordConversion(
      { token: "", orderId: "ORD-7", amountDollars: -5 },
      supabase as never,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(422);
  });
});
