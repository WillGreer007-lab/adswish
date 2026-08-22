import { createHmac } from "node:crypto";

/**
 * SocialVerify — token generation, HMAC verification, expiry, and rotation.
 * No API keys needed: ownership is proven by posting a signed token to a
 * public social bio/description.
 */

export type SocialPlatform = "youtube" | "tiktok" | "instagram" | "twitter";

export const PLATFORM_CODES: Record<SocialPlatform, string> = {
  youtube: "YO",
  tiktok: "TT",
  instagram: "IG",
  twitter: "TW",
};

export const PLATFORM_THRESHOLDS: Record<SocialPlatform, number> = {
  youtube: 10000,
  tiktok: 10000,
  instagram: 10000,
  twitter: 10000,
};

export const DEFAULT_EXPIRY_HOURS = 168; // 7 days

export interface TokenPayload {
  business_id: string;
  platform: SocialPlatform;
  handle: string;
  issued_at: number;
  expires_at: number;
  version: string;
}

export interface GeneratedToken {
  /** Short human-friendly code: VERIFY-{BUSINESS}-C-{CODE}-{sig[:8]} */
  display_code: string;
  /** Full token: VERIFY-{base64url(payload)} */
  full_token: string;
  /** HMAC-SHA256 of the canonical payload, truncated to 32 hex chars */
  signature: string;
  payload: TokenPayload;
  expires_at: string; // ISO timestamp
}

function canonicalJson(payload: TokenPayload): string {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

function sign(payload: TokenPayload, secretKey: string): string {
  return createHmac("sha256", secretKey).update(canonicalJson(payload)).digest("hex").slice(0, 32);
}

/**
 * Generate an HMAC-signed verification token for a platform.
 */
export function generateToken(
  businessId: string,
  platform: SocialPlatform,
  handle: string,
  secretKey: string,
  expiryHours: number = DEFAULT_EXPIRY_HOURS,
): GeneratedToken {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + expiryHours * 3600;

  const payload: TokenPayload = {
    business_id: businessId,
    platform,
    handle,
    issued_at: now,
    expires_at: expiresAt,
    version: "v1",
  };

  const signature = sign(payload, secretKey);
  const tokenBody = Buffer.from(canonicalJson(payload)).toString("base64url");
  const code = PLATFORM_CODES[platform];
  const shortId = businessId.slice(0, 6).toUpperCase();

  return {
    display_code: `VERIFY-${shortId}-C-${code}-${signature.slice(0, 8)}`,
    full_token: `VERIFY-${tokenBody}`,
    signature,
    payload,
    expires_at: new Date(expiresAt * 1000).toISOString(),
  };
}

export interface TokenVerification {
  valid: boolean;
  expired: boolean;
  tampered: boolean;
  payload: TokenPayload | null;
  platform: SocialPlatform | null;
  handle: string | null;
}

/**
 * Verify a token's signature (timing-safe) and expiry.
 */
export function verifyToken(fullToken: string, signature: string, secretKey: string): TokenVerification {
  const empty: TokenVerification = {
    valid: false,
    expired: false,
    tampered: false,
    payload: null,
    platform: null,
    handle: null,
  };

  try {
    const tokenBody = fullToken.replace(/^VERIFY-/, "");
    // Restore base64 padding, then decode.
    const padding = 4 - (tokenBody.length % 4);
    const padded = padding !== 4 ? tokenBody + "=".repeat(padding) : tokenBody;
    const payloadJson = Buffer.from(padded, "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson) as TokenPayload;

    const expectedSig = sign(payload, secretKey);
    const tampered = !timingSafeEqual(expectedSig, signature);
    const expired = Math.floor(Date.now() / 1000) > payload.expires_at;

    return {
      valid: !tampered && !expired,
      expired,
      tampered,
      payload,
      platform: payload.platform,
      handle: payload.handle,
    };
  } catch {
    return empty;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ============================================================
// TokenRotator — expiry checking
// ============================================================

export type TokenExpiryStatus = "active" | "expiring_soon" | "warning" | "expired";

export interface TokenExpiry {
  status: TokenExpiryStatus;
  remaining_seconds: number;
  remaining_human: string;
  percent_used: number;
}

/**
 * Check a token payload's expiry status.
 */
export function checkExpiry(payload: TokenPayload): TokenExpiry {
  const now = Math.floor(Date.now() / 1000);
  const totalLifetime = payload.expires_at - payload.issued_at;
  const remaining = payload.expires_at - now;

  let status: TokenExpiryStatus = "active";
  if (remaining <= 0) status = "expired";
  else if (remaining < 86400) status = "expiring_soon";
  else if (remaining < 259200) status = "warning";

  return {
    status,
    remaining_seconds: Math.max(0, Math.floor(remaining)),
    remaining_human: formatDuration(remaining),
    percent_used: totalLifetime > 0 ? Math.round(((now - payload.issued_at) / totalLifetime) * 1000) / 10 : 100,
  };
}

/**
 * Format seconds into a human-readable duration.
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "Expired";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

/**
 * True when a token is within 24h of expiry or already expired.
 */
export function needsRotation(payload: TokenPayload): boolean {
  const { status } = checkExpiry(payload);
  return status === "expired" || status === "expiring_soon";
}
