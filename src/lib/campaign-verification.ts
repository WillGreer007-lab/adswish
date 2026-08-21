/**
 * Campaign-level verification locking/unlocking logic for SocialVerify.
 */

import type { SocialPlatform } from "./verification-token";
import { PLATFORM_THRESHOLDS } from "./verification-token";

export type CampaignStatus =
  | "draft"
  | "pending_verification"
  | "under_review"
  | "verified"
  | "locked";

export interface PlatformVerificationRow {
  platform: SocialPlatform;
  status: "pending" | "verifying" | "verified" | "failed" | "expired";
  follower_count: number;
  threshold_met: boolean;
  token_posted: boolean;
}

/**
 * Determine the effective campaign status based on platform verification states.
 */
export function computeCampaignStatus(
  currentStatus: CampaignStatus,
  selectedPlatforms: SocialPlatform[],
  platformRows: PlatformVerificationRow[],
): CampaignStatus {
  // Draft campaigns stay draft until submitted
  if (currentStatus === "draft") return "draft";

  // Already verified stays verified (unless re-opened)
  if (currentStatus === "verified") return "verified";

  if (selectedPlatforms.length === 0) return "pending_verification";

  const allVerified = selectedPlatforms.every((pf) => {
    const row = platformRows.find((r) => r.platform === pf);
    return row?.status === "verified" && row.threshold_met;
  });

  if (allVerified) return "pending_verification"; // ready for review/submit

  return "locked";
}

/**
 * Check if a specific platform meets its follower threshold.
 */
export function checkThreshold(
  platform: SocialPlatform,
  followerCount: number,
): boolean {
  return followerCount >= PLATFORM_THRESHOLDS[platform];
}

/**
 * Build the lock banner message from unverified platforms.
 */
export function buildLockBanner(
  selectedPlatforms: SocialPlatform[],
  platformRows: PlatformVerificationRow[],
): { locked: boolean; message: string; unverified: SocialPlatform[] } {
  const unverified = selectedPlatforms.filter((pf) => {
    const row = platformRows.find((r) => r.platform === pf);
    return !row || row.status !== "verified" || !row.threshold_met;
  });

  if (unverified.length === 0) {
    return { locked: false, message: "", unverified: [] };
  }

  const names = unverified.map(platformDisplayName);
  return {
    locked: true,
    message: `Campaign locked. ${unverified.length} pending: ${names.join(", ")}`,
    unverified,
  };
}

/**
 * Validate that a platform selection is valid.
 */
export function validatePlatformSelection(
  platforms: string[],
): { valid: boolean; errors: string[] } {
  const validPlatforms: SocialPlatform[] = ["youtube", "tiktok", "instagram", "twitter"];
  const errors: string[] = [];

  for (const p of platforms) {
    if (!validPlatforms.includes(p as SocialPlatform)) {
      errors.push(`Unknown platform: ${p}`);
    }
  }

  // Deduplicate
  const unique = [...new Set(platforms)];
  if (unique.length !== platforms.length) {
    errors.push("Duplicate platforms in selection");
  }

  return { valid: errors.length === 0, errors };
}

export function platformDisplayName(platform: SocialPlatform): string {
  const names: Record<SocialPlatform, string> = {
    youtube: "YouTube",
    tiktok: "TikTok",
    instagram: "Instagram",
    twitter: "Twitter / X",
  };
  return names[platform];
}

export function platformThreshold(platform: SocialPlatform): number {
  return PLATFORM_THRESHOLDS[platform];
}
