import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkSLADisputes,
  checkDeliverableDeadlines,
  checkPixelPenalty,
} from "@/lib/background-jobs";

type Row = Record<string, unknown>;

const { mockClient, logAdminAction } = vi.hoisted(() => ({
  mockClient: { current: null as unknown },
  logAdminAction: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => mockClient.current,
}));
vi.mock("@/lib/admin/audit-log", () => ({
  logAdminAction,
}));

function makeFakeSupabase(config: { lists?: Record<string, unknown[]>; singles?: Record<string, Row | null> }) {
  const updates: Array<{ table: string; payload: Row; eq?: [string, unknown] }> = [];
  const inserts: Array<{ table: string; payload: Row }> = [];

  const makeQuery = (table: string) => {
    const q: Record<string, unknown> = {
      then(resolve: (v: unknown) => void) {
        return resolve({ data: config.lists?.[table] ?? null, error: null });
      },
      eq: () => q,
      lt: () => q,
      gte: () => q,
      is: () => q,
      in: () => q,
      single: async () => ({ data: config.singles?.[table] ?? null, error: null }),
    };
    return q as never;
  };

  const supabase = {
    updates,
    inserts,
    from(table: string) {
      return {
        select: () => makeQuery(table),
        update: (payload: Row) => {
          const u: Record<string, unknown> = {
            then(resolve: (v: unknown) => void) {
              return resolve({ error: null });
            },
          };
          u.eq = (k: string, v: unknown) => {
            updates.push({ table, payload, eq: [k, v] });
            return u;
          };
          u.in = () => u;
          u.is = () => u;
          return u as never;
        },
        insert: (payload: Row) => {
          inserts.push({ table, payload });
          return { then(resolve: (v: unknown) => void) { return resolve({ error: null }); } } as never;
        },
      };
    },
  };
  return supabase;
}

beforeEach(() => {
  logAdminAction.mockClear();
});

describe("checkDeliverableDeadlines (grace period vs advanced timestamps)", () => {
  it("moves an overdue, unsubmitted deliverable into grace_period within 24h", async () => {
    const deadline = new Date("2026-08-18T00:00:00Z");
    const now = new Date(deadline.getTime() + 2 * 60 * 60 * 1000); // +2h (within grace)
    const supabase = makeFakeSupabase({
      lists: {
        deliverables: [
          { id: "d1", campaign_id: "c1", creator_id: "u1", deadline_date: deadline.toISOString(), submitted_url: null, grace_period_task_id: null },
        ],
      },
    });
    mockClient.current = supabase;

    await checkDeliverableDeadlines(now);

    const update = supabase.updates.find((u) => u.table === "deliverables" && u.eq?.[1] === "d1");
    expect(update?.payload.status).toBe("grace_period");
    expect(supabase.inserts.some((i) => i.table === "notifications")).toBe(true);
  });

  it("kicks an overdue deliverable after the 24h grace window", async () => {
    const deadline = new Date("2026-08-18T00:00:00Z");
    const now = new Date(deadline.getTime() + 25 * 60 * 60 * 1000); // +25h (past grace)
    const supabase = makeFakeSupabase({
      lists: {
        deliverables: [
          { id: "d2", campaign_id: "c1", creator_id: "u1", deadline_date: deadline.toISOString(), submitted_url: null, grace_period_task_id: null },
        ],
      },
    });
    mockClient.current = supabase;

    await checkDeliverableDeadlines(now);

    const update = supabase.updates.find((u) => u.table === "deliverables" && u.eq?.[1] === "d2");
    expect(update?.payload.status).toBe("kicked");
  });
});

describe("checkSLADisputes (72h auto-resolve)", () => {
  it("resolves a dispute older than 72h: campaign cancelled + business strike applied", async () => {
    const now = new Date("2026-08-18T12:00:00Z");
    const supabase = makeFakeSupabase({
      lists: {
        sla_disputes: [
          {
            id: "sla1",
            raised_by: "creator1",
            related_deliverable_id: "d1",
            related_conversion_id: null,
            opened_at: new Date(now.getTime() - 80 * 60 * 60 * 1000).toISOString(),
          },
        ],
      },
      singles: {
        deliverables: { campaign_id: "c1" },
        campaigns: { business_id: "biz1", status: "active" },
        business_profiles: { strikes: 0 },
      },
    });
    mockClient.current = supabase;

    await checkSLADisputes(now);

    // Dispute resolved + dismissed.
    const disputeUpdate = supabase.updates.find((u) => u.table === "sla_disputes");
    expect(disputeUpdate?.payload.status).toBe("resolved");
    expect(disputeUpdate?.payload.resolution).toBe("dismissed");

    // Campaign cancelled.
    const campaignUpdate = supabase.updates.find((u) => u.table === "campaigns");
    expect(campaignUpdate?.payload.status).toBe("cancelled");

    // Tracking links revoked + deliverables dropped.
    expect(supabase.updates.some((u) => u.table === "tracking_links")).toBe(true);
    expect(supabase.updates.some((u) => u.table === "deliverables" && u.payload.status === "auto_dropped_sla")).toBe(true);

    // Business strike bumped to 1.
    const bizUpdate = supabase.updates.find((u) => u.table === "business_profiles");
    expect(bizUpdate?.payload.strikes).toBe(1);

    // Notification to the business.
    expect(supabase.inserts.some((i) => i.table === "notifications")).toBe(true);
  });

  it("leaves a fresh dispute (<72h) untouched", async () => {
    const now = new Date("2026-08-18T12:00:00Z");
    const supabase = makeFakeSupabase({ lists: { sla_disputes: [] } });
    mockClient.current = supabase;
    await checkSLADisputes(now);
    expect(supabase.updates).toHaveLength(0);
  });
});

describe("checkPixelPenalty (12h offline)", () => {
  it("warns business + creators on first detection, no suspension yet", async () => {
    const now = new Date("2026-08-18T12:00:00Z");
    const supabase = makeFakeSupabase({
      lists: {
        campaigns: [
          {
            id: "c1",
            business_id: "biz1",
            title: "Pixel Test",
            last_pixel_ping_at: "2026-08-17T00:00:00Z",
            offline_warning_sent_at: null,
            pixel_offline_at: null,
          },
        ],
        deliverables: [{ creator_id: "creator1" }],
      },
    });
    mockClient.current = supabase;

    await checkPixelPenalty(now);

    const offline = supabase.updates.find(
      (u) => u.table === "campaigns" && u.payload.pixel_status === "offline",
    );
    expect(offline?.payload.pixel_offline_at).toBe(now.toISOString());
    expect(
      supabase.updates.some(
        (u) => u.table === "campaigns" && u.payload.offline_warning_sent_at,
      ),
    ).toBe(true);
    // Business + creator each get a warning.
    expect(supabase.inserts.filter((i) => i.table === "notifications")).toHaveLength(2);
    // No suspension on the first pass.
    expect(
      supabase.updates.some((u) => u.table === "campaigns" && u.payload.status === "paused"),
    ).toBe(false);
  });

  it("suspends (pause all activity) when still offline after the warning", async () => {
    const now = new Date("2026-08-18T12:00:00Z");
    const supabase = makeFakeSupabase({
      lists: {
        campaigns: [
          {
            id: "c2",
            business_id: "biz1",
            title: "Still Offline",
            last_pixel_ping_at: "2026-08-17T00:00:00Z",
            offline_warning_sent_at: "2026-08-17T23:00:00Z",
            pixel_offline_at: "2026-08-17T23:00:00Z",
          },
        ],
        deliverables: [],
      },
    });
    mockClient.current = supabase;

    await checkPixelPenalty(now);

    const suspend = supabase.updates.find(
      (u) => u.table === "campaigns" && u.payload.status === "paused",
    );
    expect(suspend?.payload.pause_mode).toBe("all_activity");
    expect(suspend?.payload.pause_reason).toBe("pixel_offline");
    expect(supabase.inserts.some((i) => i.table === "notifications")).toBe(true);
  });

  it("leaves a recently-pinged pixel alone", async () => {
    const now = new Date("2026-08-18T12:00:00Z");
    const supabase = makeFakeSupabase({
      lists: {
        campaigns: [
          {
            id: "c3",
            business_id: "biz1",
            title: "Fresh",
            last_pixel_ping_at: "2026-08-18T11:00:00Z",
            offline_warning_sent_at: null,
            pixel_offline_at: null,
          },
        ],
      },
    });
    mockClient.current = supabase;

    await checkPixelPenalty(now);

    expect(supabase.updates).toHaveLength(0);
    expect(supabase.inserts).toHaveLength(0);
  });
});
