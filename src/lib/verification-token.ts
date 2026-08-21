import { createHmac } from "node:crypto";

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
