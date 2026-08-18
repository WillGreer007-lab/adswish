import { SignJWT, jwtVerify } from "jose";

// HMAC secret shared by the tracking-redirect issuer and the conversion verifier.
function secretKey(): Uint8Array {
  return new TextEncoder().encode(
    process.env.JWT_SIGNING_SECRET || "adswish-dev-tracking-secret",
  );
}

export interface TrackingClaims {
  /** tracking_links.id */
  linkId: string;
  creatorId: string;
  campaignId: string;
  deliverableId: string | null;
  /** IP fingerprint (SHA-256 hex, truncated) — cross-device detection. */
  ipHash: string;
  /** User-agent fingerprint (SHA-256 hex, truncated). */
  uaHash: string;
  /** jti (JWT ID) — checked against the revoked_jtis blocklist. */
  jti: string;
  /** issued_at epoch seconds. */
  iat: number;
  /** expiry epoch seconds. */
  exp: number;
}

interface SignOptions {
  linkId: string;
  creatorId: string;
  campaignId: string;
  deliverableId: string | null;
  ipHash: string;
  uaHash: string;
  jti: string;
  ttlSeconds: number;
}

/**
 * Sign a short-lived tracking token. The token is appended to the destination
 * URL as `?adswish_ref=...` and later verified by the conversion webhook.
 */
export async function signTrackingJwt(opts: SignOptions): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    link_id: opts.linkId,
    creator_id: opts.creatorId,
    campaign_id: opts.campaignId,
    deliverable_id: opts.deliverableId ?? null,
    ip_hash: opts.ipHash,
    ua_hash: opts.uaHash,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(opts.jti)
    .setIssuedAt(now)
    .setExpirationTime(now + opts.ttlSeconds)
    .sign(secretKey());
}

/**
 * Verify a tracking token. Throws when invalid, tampered, or expired — callers
 * map that to a 410 Gone (never a 302 redirect, per the blueprint).
 */
export async function verifyTrackingJwt(token: string): Promise<TrackingClaims> {
  const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });

  const claims: TrackingClaims = {
    linkId: typeof payload.link_id === "string" ? payload.link_id : "",
    creatorId: typeof payload.creator_id === "string" ? payload.creator_id : "",
    campaignId: typeof payload.campaign_id === "string" ? payload.campaign_id : "",
    deliverableId:
      typeof payload.deliverable_id === "string" ? payload.deliverable_id : null,
    ipHash: typeof payload.ip_hash === "string" ? payload.ip_hash : "",
    uaHash: typeof payload.ua_hash === "string" ? payload.ua_hash : "",
    jti: typeof payload.jti === "string" ? payload.jti : "",
    iat: typeof payload.iat === "number" ? payload.iat : 0,
    exp: typeof payload.exp === "number" ? payload.exp : 0,
  };

  if (
    !claims.linkId ||
    !claims.creatorId ||
    !claims.campaignId ||
    !claims.jti ||
    !claims.exp
  ) {
    throw new Error("Tracking token missing required claims");
  }
  return claims;
}

/**
 * SHA-256 hex truncated to 32 chars. Web Crypto (`crypto.subtle`) so this works
 * in the Edge runtime; falls back to node:crypto for the jsdom test env where
 * `crypto.subtle` is not always present.
 */
export async function sha256Hex(input: string): Promise<string> {
  const value = input || "unknown";
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (subtle) {
    const data = new TextEncoder().encode(value);
    const digest = await subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

/** Legacy alias kept for any existing callers. */
export async function hashIp(ip: string): Promise<string> {
  return sha256Hex(ip);
}
