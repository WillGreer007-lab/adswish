import { createHmac, randomBytes } from "node:crypto";

/**
 * Stateless, per-user + per-platform proof-of-ownership token.
 *
 * A creator pastes this code into their platform bio/description (and shows it
 * in their verification screenshot); the system (or an admin) reads it back to
 * confirm the account is actually controlled by the creator — not just claimed.
 * Derived from the JWT signing secret + user id + platform, so it is stable
 * (paste once) without any database storage.
 */
export function deriveVerificationToken(userId: string, platform: string): string {
  const secret =
    process.env.JWT_SIGNING_SECRET || process.env.MESSAGE_ENCRYPTION_KEY || "adswish-verification";
  const digest = createHmac("sha256", secret)
    .update(`verification:${platform}:${userId}`)
    .digest("base64url");
  const cleaned = digest
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/[O0I1L]/g, "X"); // strip easily-confused characters
  return `ADSWISH-${cleaned.slice(0, 6)}`;
}

// ============================================================
// Campaign-level verification tokens (SocialVerify)
// ============================================================

export type SocialPlatform = "youtube" | "tiktok" | "instagram" | "twitter";

export const PLATFORM_CODES: Record<SocialPlatform, string> = {
  youtube: "YO",
  tiktok: "TT",
  instagram: "IG",
  twitter: "TW",
};

export const PLATFORM_THRESHOLDS: Record<SocialPlatform, number> = {
  youtube: 1000,
  tiktok: 5000,
  instagram: 3000,
  twitter: 2500,
};

export const TOKEN_EXPIRY_HOURS = 168; // 7 days

export interface CampaignTokenPayload {
  business_id: string;
  platform: SocialPlatform;
  handle: string;
  issued_at: number;
  expires_at: number;
  version: string;
}

export interface CampaignTokenResult {
  display_code: string;
  full_token: string;
  signature: string;
  payload: CampaignTokenPayload;
  expires_at: string;
}

/**
 * Generate a campaign-level verification token for a specific platform.
 * The token is HMAC-signed with a secret key and has a 7-day expiry.
 */
export function generateCampaignToken(
  businessId: string,
  platform: SocialPlatform,
  handle: string,
  secretKey: string,
): CampaignTokenResult {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + TOKEN_EXPIRY_HOURS * 3600;

  const payload: CampaignTokenPayload = {
    business_id: businessId,
    platform,
    handle,
    issued_at: now,
    expires_at: expiresAt,
    version: "v1",
  };

  const payloadJson = JSON.stringify(payload, Object.keys(payload).sort());
  const signature = createHmac("sha256", secretKey)
    .update(payloadJson)
    .digest("hex")
    .slice(0, 32);

  const tokenBody = Buffer.from(payloadJson).toString("base64url");
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

/**
 * Verify a campaign token's signature and check expiry.
 */
export function verifyCampaignToken(
  fullToken: string,
  signature: string,
  secretKey: string,
): {
  valid: boolean;
  expired: boolean;
  tampered: boolean;
  payload: CampaignTokenPayload | null;
  platform: SocialPlatform | null;
  handle: string | null;
} {
  const empty = {
    valid: false,
    expired: false,
    tampered: false,
    payload: null,
    platform: null,
    handle: null,
  };

  try {
    const tokenBody = fullToken.replace("VERIFY-", "");
    const payloadJson = Buffer.from(tokenBody, "base64url").toString("utf-8");
    const payload: CampaignTokenPayload = JSON.parse(payloadJson);

    const expectedSig = createHmac("sha256", secretKey)
      .update(JSON.stringify(payload, Object.keys(payload).sort()))
      .digest("hex")
      .slice(0, 32);

    const tampered = expectedSig !== signature;
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

/**
 * Generate a unique bio-verification code for a user + platform.
 * This is the stable code that goes into a creator's social bio.
 */
export function generateBioCode(userId: string, platform: SocialPlatform): string {
  return deriveVerificationToken(userId, platform);
}
