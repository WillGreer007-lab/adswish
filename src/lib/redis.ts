import { Redis } from "@upstash/redis";

/**
 * Upstash Redis wrapper (rate limiting + jti blocklist).
 *
 * Everything here fails open: if Redis is not configured or the REST call
 * throws, the caller proceeds. A rate-limiter/cache outage must never take the
 * tracking redirect or conversion webhook down.
 */

export function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** epoch ms when the current window resets. */
  resetAt: number;
}

/**
 * Fixed-window counter (atomic via INCR). `key` should include the actor
 * (ip hash, user id, business id) and the endpoint, e.g. `redirect:{ipHash}`.
 */
export async function checkRateLimit(opts: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const windowMs = opts.windowSeconds * 1000;
  const now = Date.now();
  const resetAt = (Math.floor(now / windowMs) + 1) * windowMs;
  const fallback: RateLimitResult = { allowed: true, remaining: opts.limit, resetAt };

  const redis = getRedis();
  if (!redis) return fallback;

  try {
    const bucket = Math.floor(now / windowMs);
    const k = `adswish:rl:${opts.key}:${bucket}`;
    const count = await redis.incr(k);
    if (count === 1) {
      await redis.expire(k, opts.windowSeconds * 2);
    }
    return {
      allowed: count <= opts.limit,
      remaining: Math.max(0, opts.limit - count),
      resetAt,
    };
  } catch {
    return fallback;
  }
}

/**
 * Fixed-window counter (atomic INCR). Returns the count after incrementing, or
 * null when Redis is unavailable (callers then allow). Use this where the
 * caller needs the raw count (e.g. "N applies per 24h") rather than a
 * pass/fail gate.
 */
export async function incrementCounter(opts: {
  key: string;
  windowSeconds: number;
}): Promise<number | null> {
  const windowMs = opts.windowSeconds * 1000;
  const bucket = Math.floor(Date.now() / windowMs);
  const k = `adswish:ctr:${opts.key}:${bucket}`;
  const redis = getRedis();
  if (!redis) return null;
  try {
    const count = await redis.incr(k);
    if (count === 1) {
      await redis.expire(k, opts.windowSeconds * 2);
    }
    return count;
  } catch {
    return null;
  }
}

const REVOKED_SET = "adswish:revoked_jtis";

/**
 * Mark a jti as revoked in Redis (the Postgres `revoked_jtis` table remains the
 * source of truth; this set is the fast-path cache with the same TTL semantics).
 */
export async function markJtiRevoked(jti: string): Promise<void> {
  if (!jti) return;
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.sadd(REVOKED_SET, jti);
  } catch {
    // cache miss is safe — callers also check Postgres
  }
}

/**
 * Fast-path check. Returns true only when Redis definitively says revoked;
 * a miss/error returns false and the caller falls back to Postgres.
 */
export async function isJtiRevoked(jti: string): Promise<boolean> {
  if (!jti) return false;
  const redis = getRedis();
  if (!redis) return false;
  try {
    return Boolean(await redis.sismember(REVOKED_SET, jti));
  } catch {
    return false;
  }
}
