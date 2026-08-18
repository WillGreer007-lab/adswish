import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      single: vi.fn().mockResolvedValue({ data: null }),
    })),
  }),
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
});
