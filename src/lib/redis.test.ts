// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

const fake = vi.hoisted(() => ({
  incr: vi.fn(),
  expire: vi.fn(),
  sadd: vi.fn(),
  sismember: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(() => ({
    incr: fake.incr,
    expire: fake.expire,
    sadd: fake.sadd,
    sismember: fake.sismember,
  })),
}));

import { checkRateLimit, isJtiRevoked, markJtiRevoked } from "@/lib/redis";

function enableRedis() {
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("checkRateLimit", () => {
  it("fails open when Redis is not configured", async () => {
    const r = await checkRateLimit({ key: "x", limit: 5, windowSeconds: 60 });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(5);
  });

  it("allows under the limit and blocks over it", async () => {
    enableRedis();
    fake.incr.mockResolvedValue(1);
    const ok = await checkRateLimit({ key: "x", limit: 5, windowSeconds: 60 });
    expect(ok.allowed).toBe(true);

    fake.incr.mockResolvedValue(6);
    const blocked = await checkRateLimit({ key: "x", limit: 5, windowSeconds: 60 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("fails open on Redis errors", async () => {
    enableRedis();
    fake.incr.mockRejectedValue(new Error("boom"));
    const r = await checkRateLimit({ key: "x", limit: 5, windowSeconds: 60 });
    expect(r.allowed).toBe(true);
  });

  it("sets an expiry on the first request in a window", async () => {
    enableRedis();
    fake.incr.mockResolvedValue(1);
    await checkRateLimit({ key: "x", limit: 5, windowSeconds: 60 });
    expect(fake.expire).toHaveBeenCalled();
  });
});

describe("jti blocklist", () => {
  it("returns true only when Redis has the jti", async () => {
    enableRedis();
    fake.sismember.mockResolvedValue(1);
    await expect(isJtiRevoked("jti-1")).resolves.toBe(true);

    fake.sismember.mockResolvedValue(0);
    await expect(isJtiRevoked("jti-2")).resolves.toBe(false);
  });

  it("returns false when Redis is unavailable (caller falls back to Postgres)", async () => {
    await expect(isJtiRevoked("jti-3")).resolves.toBe(false);
  });

  it("markJtiRevoked adds to the revoked set", async () => {
    enableRedis();
    fake.sadd.mockResolvedValue(1);
    await markJtiRevoked("jti-4");
    expect(fake.sadd).toHaveBeenCalledWith("adswish:revoked_jtis", "jti-4");
  });
});
