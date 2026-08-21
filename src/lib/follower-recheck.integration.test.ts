import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { recheckFollowerCounts } from "@/lib/follower-recheck";

/**
 * End-to-end follower re-check against an in-memory DB and a stubbed TikTok
 * API: the real `recheckFollowerCounts` sweeps a connected account, stamps the
 * live follower count, and recomputes the creator's tier + badges — the exact
 * path a creator's connect flows into after TikTok OAuth stores their token.
 */

const { mockService, refreshCreatorBadges } = vi.hoisted(() => ({
  mockService: { current: null as unknown },
  refreshCreatorBadges: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => mockService.current,
}));

vi.mock("@/lib/badges", () => ({
  refreshCreatorBadges: (...args: unknown[]) => refreshCreatorBadges(...args),
}));

type Row = Record<string, unknown>;

class MemDB {
  rows: Record<string, Row[]> = {};

  seed(table: string, data: Row[]) {
    this.rows[table] = data.map((r) => ({ ...r }));
  }

  from(table: string) {
    const db = this;
    return {
      select: () => {
        const filters: Array<(r: Row) => boolean> = [];
        const builder: Record<string, unknown> = {
          eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return builder; },
          is: (k: string, v: unknown) => { filters.push((r) => (v === null ? r[k] == null : r[k] === v)); return builder; },
          not: (k: string, op: string, v: unknown) => { filters.push((r) => (op === "is" ? (v === null ? r[k] != null : r[k] !== v) : true)); return builder; },
          maybeSingle: async () => {
            const hit = (db.rows[table] ?? []).find((r) => filters.every((f) => f(r)));
            return { data: hit ? { ...hit } : null, error: null };
          },
          single: async () => {
            const hit = (db.rows[table] ?? []).find((r) => filters.every((f) => f(r)));
            return { data: hit ? { ...hit } : null, error: null };
          },
          then: (resolve: (v: unknown) => void) => {
            const out = (db.rows[table] ?? []).filter((r) => filters.every((f) => f(r)));
            resolve({ data: out.map((r) => ({ ...r })), error: null });
          },
        };
        return builder;
      },
      update: (payload: Row) => {
        const filters: Array<(r: Row) => boolean> = [];
        const builder: Record<string, unknown> = {
          eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return builder; },
          then: (resolve: (v: unknown) => void) => {
            const out = (db.rows[table] ?? []).filter((r) => filters.every((f) => f(r)));
            for (const r of out) Object.assign(r, payload);
            resolve({ data: null, error: null });
          },
        };
        return builder;
      },
    };
  }
}

let db: MemDB;

beforeEach(() => {
  db = new MemDB();
  mockService.current = db;
  refreshCreatorBadges.mockReset();
  process.env.TIKTOK_CLIENT_KEY = "test-key";
  vi.stubGlobal("fetch", async (url: unknown) => {
    const u = String(url);
    if (u.includes("tiktokapis.com/v2/user/info")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { user: { follower_count: 250_000 } } }),
      };
    }
    throw new Error("unexpected fetch " + u);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("recheckFollowerCounts (TikTok)", () => {
  it("stamps the live follower count and refreshes the creator's tier + badges", async () => {
    db.seed("creator_social_accounts", [
      { id: "sa_1", creator_id: "creator_1", platform: "tiktok", handle: "test", access_token: "tok", refresh_token: null, follower_count: 100 },
    ]);
    db.seed("creator_profiles", [{ user_id: "creator_1", tier: "micro" }]);

    const result = await recheckFollowerCounts();

    expect(result).toEqual({ accounts: 1, updated: 1, skipped: 0, failed: 0, tiersChanged: 1 });

    const social = db.rows.creator_social_accounts[0];
    expect(social.follower_count).toBe(250_000);
    expect(social.verified_at).toBeTruthy();

    const profile = db.rows.creator_profiles[0];
    expect(profile.tier).toBe("macro");
    expect(profile.previous_tier).toBe("micro");
    expect(profile.tier_changed_at).toBeTruthy();

    expect(refreshCreatorBadges).toHaveBeenCalledWith("creator_1");
  });

  it("skips TikTok (not failed) when the client key is not configured", async () => {
    delete process.env.TIKTOK_CLIENT_KEY;
    db.seed("creator_social_accounts", [
      { id: "sa_1", creator_id: "creator_1", platform: "tiktok", handle: "test", access_token: "tok", refresh_token: null, follower_count: 100 },
    ]);
    db.seed("creator_profiles", [{ user_id: "creator_1", tier: "micro" }]);

    const result = await recheckFollowerCounts();

    expect(result).toEqual({ accounts: 1, updated: 0, skipped: 1, failed: 0, tiersChanged: 0 });
    expect(db.rows.creator_social_accounts[0].follower_count).toBe(100); // untouched
    expect(db.rows.creator_profiles[0].tier).toBe("micro");
  });
});
