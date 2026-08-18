// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  generateTrackingSlug,
  isTrackingActive,
  createTrackingLink,
} from "@/lib/tracking-links";

describe("generateTrackingSlug", () => {
  it("produces 8-char unambiguous alphanumeric slugs", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateTrackingSlug()).toMatch(/^[A-Za-z2-9]{8}$/);
    }
  });

  it("produces unique slugs", () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateTrackingSlug()));
    expect(set.size).toBe(1000);
  });
});

describe("isTrackingActive", () => {
  it("tracks active and budget-paused campaigns", () => {
    expect(isTrackingActive({ status: "active", pause_mode: null })).toBe(true);
    expect(isTrackingActive({ status: "paused_budget", pause_mode: null })).toBe(true);
  });

  it("paused new_applications keeps tracking; all_activity disables it", () => {
    expect(isTrackingActive({ status: "paused", pause_mode: "new_applications" })).toBe(true);
    expect(isTrackingActive({ status: "paused", pause_mode: "all_activity" })).toBe(false);
    expect(isTrackingActive({ status: "paused", pause_mode: null })).toBe(false);
  });

  it("never tracks draft/cancelled/completed campaigns", () => {
    expect(isTrackingActive({ status: "draft", pause_mode: null })).toBe(false);
    expect(isTrackingActive({ status: "cancelled", pause_mode: null })).toBe(false);
    expect(isTrackingActive({ status: "completed", pause_mode: null })).toBe(false);
  });
});

function makeSupabase(opts: {
  results?: Array<{ error: { code?: string; message?: string } | null; data?: unknown }>;
}) {
  const inserts: Array<Record<string, unknown>> = [];
  let call = 0;
  const supabase = {
    inserts,
    from() {
      return {
        insert: (payload: Record<string, unknown>) => {
          inserts.push(payload);
          return {
            select: () => ({
              single: async () => {
                const r = opts.results?.[call] ?? opts.results?.[0] ?? { error: null, data: { id: "l1", slug: "abcd2345", jti: "j1" } };
                call++;
                return r;
              },
            }),
          };
        },
      };
    },
  };
  return supabase;
}

describe("createTrackingLink", () => {
  it("inserts with the right payload and returns the link", async () => {
    const supabase = makeSupabase({
      results: [{ error: null, data: { id: "l1", slug: "abcd2345", jti: "j1" } }],
    });
    const link = await createTrackingLink(
      { deliverableId: "d1", creatorId: "c1", campaignId: "camp1", destinationUrl: "https://shop.com" },
      supabase as never,
    );
    expect(link?.id).toBe("l1");
    expect(link?.slug).toBe("abcd2345");
    expect(supabase.inserts[0]).toMatchObject({
      deliverable_id: "d1",
      creator_id: "c1",
      campaign_id: "camp1",
      destination_url: "https://shop.com",
    });
  });

  it("retries once on a slug collision, then succeeds", async () => {
    const supabase = makeSupabase({
      results: [
        { error: { code: "23505", message: "dup" }, data: null },
        { error: null, data: { id: "l2", slug: "efgh6789", jti: "j2" } },
      ],
    });
    const link = await createTrackingLink(
      { deliverableId: null, creatorId: "c1", campaignId: "camp1", destinationUrl: "https://shop.com" },
      supabase as never,
    );
    expect(link?.id).toBe("l2");
    expect(supabase.inserts).toHaveLength(2);
  });

  it("returns null on a non-collision error", async () => {
    const supabase = makeSupabase({
      results: [{ error: { code: "23503", message: "fk" }, data: null }],
    });
    const link = await createTrackingLink(
      { deliverableId: null, creatorId: "c1", campaignId: "camp1", destinationUrl: "https://shop.com" },
      supabase as never,
    );
    expect(link).toBeNull();
    expect(supabase.inserts).toHaveLength(1); // no retry
  });
});
