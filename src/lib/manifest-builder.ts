/**
 * Domain manifest builder for SocialVerify.
 *
 * Generates a signed JSON manifest at /.well-known/social-verification.json
 * that includes only verified accounts for a given campaign.
 */

import { createHmac } from "node:crypto";
import type { SocialPlatform } from "./verification-token";
import { PLATFORM_THRESHOLDS } from "./verification-token";

export interface ManifestAccount {
  platform: SocialPlatform;
  handle: string;
  url: string;
  verification_token: string;
  follower_count: number;
  follower_threshold: number;
  threshold_met: boolean;
  verified_at: string;
}

export interface SocialVerificationManifest {
  domain: string;
  business_id: string;
  business_name: string;
  selected_platforms: SocialPlatform[];
  accounts: ManifestAccount[];
  signature: string;
  issued_at: string;
  expires_at: string;
}

const PLATFORM_URL_BUILDERS: Record<SocialPlatform, (handle: string) => string> = {
  youtube: (h) => `https://youtube.com/${h}`,
  tiktok: (h) => `https://tiktok.com/${h}`,
  instagram: (h) => `https://instagram.com/${h.replace(/^@/, "")}`,
  twitter: (h) => `https://twitter.com/${h.replace(/^@/, "")}`,
};

/**
 * Build a signed social-verification manifest.
 */
export function buildManifest(params: {
  domain: string;
  businessId: string;
  businessName: string;
  secretKey: string;
  accounts: Array<{
    platform: SocialPlatform;
    handle: string;
    verificationToken: string;
    followerCount: number;
    verifiedAt: string;
  }>;
}): SocialVerificationManifest {
  const { domain, businessId, businessName, secretKey } = params;

  const manifestAccounts: ManifestAccount[] = params.accounts.map((a) => {
    const threshold = PLATFORM_THRESHOLDS[a.platform];
    return {
      platform: a.platform,
      handle: a.handle,
      url: PLATFORM_URL_BUILDERS[a.platform](a.handle),
      verification_token: a.verificationToken,
      follower_count: a.followerCount,
      follower_threshold: threshold,
      threshold_met: a.followerCount >= threshold,
      verified_at: a.verifiedAt,
    };
  });

  const selectedPlatforms = [...new Set(manifestAccounts.map((a) => a.platform))];

  const manifest: Omit<SocialVerificationManifest, "signature"> = {
    domain,
    business_id: businessId,
    business_name: businessName,
    selected_platforms: selectedPlatforms,
    accounts: manifestAccounts,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  };

  const manifestJson = JSON.stringify(manifest, Object.keys(manifest).sort());
  const signature = createHmac("sha256", secretKey)
    .update(manifestJson)
    .digest("hex");

  return { ...manifest, signature: `sha256=${signature}` };
}

/**
 * Verify a manifest's signature.
 */
export function verifyManifest(
  manifest: SocialVerificationManifest,
  secretKey: string,
): boolean {
  const { signature, ...rest } = manifest;
  const manifestJson = JSON.stringify(rest, Object.keys(rest).sort());
  const expectedSig = createHmac("sha256", secretKey)
    .update(manifestJson)
    .digest("hex");

  return signature === `sha256=${expectedSig}`;
}
