/**
 * Token expiry checking and auto-rotation for SocialVerify campaign tokens.
 */

import type { CampaignTokenPayload, SocialPlatform } from "./verification-token";

export type TokenExpiryStatus = "active" | "expiring_soon" | "warning" | "expired";

export interface TokenExpiryResult {
  status: TokenExpiryStatus;
  remaining_seconds: number;
  remaining_human: string;
  percent_used: number;
}

/**
 * Check the expiry status of a campaign token payload.
 */
export function checkTokenExpiry(payload: CampaignTokenPayload): TokenExpiryResult {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = payload.expires_at;
  const issuedAt = payload.issued_at;
  const totalLifetime = expiresAt - issuedAt;
  const remaining = expiresAt - now;

  let status: TokenExpiryStatus = "active";
  if (remaining <= 0) status = "expired";
  else if (remaining < 86400) status = "expiring_soon"; // < 1 day
  else if (remaining < 259200) status = "warning"; // < 3 days

  return {
    status,
    remaining_seconds: Math.max(0, Math.floor(remaining)),
    remaining_human: formatDuration(remaining),
    percent_used: totalLifetime > 0
      ? Math.round(((now - issuedAt) / totalLifetime) * 1000) / 10
      : 100,
  };
}

/**
 * Format seconds into human-readable duration.
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "Expired";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

/**
 * Determine if a token needs rotation (within 24h of expiry or expired).
 */
export function needsRotation(payload: CampaignTokenPayload): boolean {
  const result = checkTokenExpiry(payload);
  return result.status === "expired" || result.status === "expiring_soon";
}
