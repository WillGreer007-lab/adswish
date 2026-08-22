import { describe, it, expect } from "vitest";
import { buildManifest, verifyManifest, fullAudit, type SocialVerificationManifest } from "./manifest";
import type { ScoreInput } from "./scoring";

const SECRET = "test-secret-key";

function buildSample(): SocialVerificationManifest {
  return buildManifest({
    domain: "acme-corp.com",
    businessId: "acme-corp",
    businessName: "Acme Corporation",
    secretKey: SECRET,
    accounts: [
      {
        platform: "youtube",
        handle: "@acmeofficial",
        verificationToken: "VERIFY-ACME-C-YO-abcdef12",
        followerCount: 245000,
        verifiedAt: new Date().toISOString(),
      },
      {
        platform: "twitter",
        handle: "@acmeofficial",
        verificationToken: "VERIFY-ACME-C-TW-12345678",
        followerCount: 8900,
        verifiedAt: new Date().toISOString(),
      },
    ],
  });
}

describe("buildManifest", () => {
  it("includes only the provided platforms", () => {
    const m = buildSample();
    expect(m.selected_platforms).toEqual(["youtube", "twitter"]);
    expect(m.accounts).toHaveLength(2);
  });

  it("computes thresholds and threshold_met", () => {
    const m = buildSample();
    const yt = m.accounts[0];
    expect(yt.follower_threshold).toBe(1000);
    expect(yt.threshold_met).toBe(true);
    expect(yt.url).toContain("youtube.com");
  });

  it("signs and verifies", () => {
    const m = buildSample();
    expect(m.signature).toMatch(/^sha256=/);
    expect(verifyManifest(m, SECRET)).toBe(true);
  });

  it("detects a tampered manifest", () => {
    const m = buildSample();
    const tampered = { ...m, business_name: "Evil Corp" };
    expect(verifyManifest(tampered, SECRET)).toBe(false);
  });
});

describe("fullAudit", () => {
  function metrics(overrides: Partial<ScoreInput> = {}): ScoreInput {
    return {
      platform: "instagram",
      followers: 100000,
      avg_likes_per_post: 4000,
      avg_comments_per_post: 200,
      avg_shares_per_post: 100,
      total_posts: 500,
      account_age_days: 1000,
      follower_growth_30d: 2000,
      cross_platform_verified: true,
      ...overrides,
    };
  }

  it("returns verified for a signed multi-account manifest", () => {
    const audit = fullAudit(buildSample(), SECRET, metrics());
    expect(audit.manifest_signature_valid).toBe(true);
    expect(audit.cross_platform_verified).toBe(true);
    expect(audit.status).toBe("verified");
    expect(audit.overall_score).toBeGreaterThanOrEqual(75);
    expect(audit.audit_id).toHaveLength(16);
  });

  it("fails when the manifest is tampered", () => {
    const m = buildSample();
    const tampered = { ...m, business_name: "Evil Corp" };
    const audit = fullAudit(tampered, SECRET, metrics());
    expect(audit.manifest_signature_valid).toBe(false);
    expect(audit.status).not.toBe("verified");
  });
});
