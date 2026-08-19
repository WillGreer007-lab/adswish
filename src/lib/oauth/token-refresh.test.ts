import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression tests for the token-refresh job.
 *
 * Covers the bug fixed 2026-08-19: the query chained
 * `.not("disconnected_at","is",null).is("disconnected_at",null)` — a
 * contradiction that meant NO accounts ever matched, so social token refresh
 * silently never ran. The fixed chain must (1) require a refresh_token,
 * (2) require the account to still be connected, and (3) only target tokens
 * expiring within 24h.
 */

function makeChain() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    single: vi.fn().mockResolvedValue({ data: null }),
  };
  return chain;
}

const mockSupabase = {
  from: vi.fn(() => makeChain()),
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => mockSupabase,
}));

describe("Token refresh module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("can be imported without error", async () => {
    const mod = await import("@/lib/oauth/token-refresh");
    expect(mod.refreshExpiredTokens).toBeDefined();
    expect(typeof mod.refreshExpiredTokens).toBe("function");
  });

  it("only targets connected accounts with refresh tokens expiring soon", async () => {
    const mod = await import("@/lib/oauth/token-refresh");

    // Chain returns no accounts → job should no-op cleanly.
    const from = mockSupabase.from;
    from.mockReturnValue(makeChain());

    await mod.refreshExpiredTokens();

    expect(from).toHaveBeenCalledWith("creator_social_accounts");
    const selectMock = from.mock.results[0].value.select;
    expect(selectMock).toHaveBeenCalledWith("*");

    const calls = from.mock.results[0].value.not.mock.calls as string[][];
    expect(calls).toEqual([["refresh_token", "is", null]]);
    const isCalls = from.mock.results[0].value.is.mock.calls as string[][];
    // must require still-connected (disconnected_at IS NULL)…
    expect(isCalls).toContainEqual(["disconnected_at", null]);
    // …and NOT filter on disconnected_at being non-null (the old contradiction)
    expect(calls.some((c) => c[0] === "disconnected_at")).toBe(false);
    const ltCalls = from.mock.results[0].value.lt.mock.calls as string[][];
    expect(ltCalls.some((c) => c[0] === "token_expires_at")).toBe(true);
  });
});
