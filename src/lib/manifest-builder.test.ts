import { describe, it, expect } from "vitest";
import { buildManifest, verifyManifest } from "@/lib/manifest-builder";

const SECRET = "test-manifest-secret-key";

describe("buildManifest", () => {
  it("generates a signed manifest with correct structure", () => {
    const manifest = buildManifest({
      domain: "example.com",
      businessId: "biz-123",
      businessName: "Example Corp",
      secretKey: SECRET,
      accounts: [
        {
          platform: "youtube",
          handle: "@channel",
          verificationToken: "VERIFY-TOKEN-YO",
          followerCount: 245000,
          verifiedAt: "2026-08-22T00:00:00Z",
        },
        {
          platform: "twitter",
          handle: "@example",
          verificationToken: "VERIFY-TOKEN-TW",
          followerCount: 8900,
          verifiedAt: "2026-08-22T00:00:00Z",
        },
      ],
    });

    expect(manifest.domain).toBe("example.com");
    expect(manifest.business_id).toBe("biz-123");
    expect(manifest.business_name).toBe("Example Corp");
    expect(manifest.accounts).toHaveLength(2);
    expect(manifest.selected_platforms).toContain("youtube");
    expect(manifest.selected_platforms).toContain("twitter");
    expect(manifest.signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(manifest.issued_at).toBeTruthy();
    expect(manifest.expires_at).toBeTruthy();
  });

  it("sets correct thresholds per platform", () => {
    const manifest = buildManifest({
      domain: "test.com",
      businessId: "biz-456",
      businessName: "Test",
      secretKey: SECRET,
      accounts: [
        { platform: "youtube", handle: "@yt", verificationToken: "T", followerCount: 500, verifiedAt: "" },
        { platform: "tiktok", handle: "@tt", verificationToken: "T", followerCount: 6000, verifiedAt: "" },
        { platform: "instagram", handle: "@ig", verificationToken: "T", followerCount: 2000, verifiedAt: "" },
        { platform: "twitter", handle: "@tw", verificationToken: "T", followerCount: 3000, verifiedAt: "" },
      ],
    });

    const yt = manifest.accounts.find((a) => a.platform === "youtube");
    const tt = manifest.accounts.find((a) => a.platform === "tiktok");
    const ig = manifest.accounts.find((a) => a.platform === "instagram");
    const tw = manifest.accounts.find((a) => a.platform === "twitter");

    expect(yt!.follower_threshold).toBe(1000);
    expect(yt!.threshold_met).toBe(false); // 500 < 1000
    expect(tt!.follower_threshold).toBe(5000);
    expect(tt!.threshold_met).toBe(true); // 6000 >= 5000
    expect(ig!.follower_threshold).toBe(3000);
    expect(ig!.threshold_met).toBe(false); // 2000 < 3000
    expect(tw!.follower_threshold).toBe(2500);
    expect(tw!.threshold_met).toBe(true); // 3000 >= 2500
  });
});

describe("verifyManifest", () => {
  it("verifies a valid manifest signature", () => {
    const manifest = buildManifest({
      domain: "example.com",
      businessId: "biz-789",
      businessName: "Test",
      secretKey: SECRET,
      accounts: [
        { platform: "youtube", handle: "@ch", verificationToken: "T", followerCount: 1000, verifiedAt: "" },
      ],
    });

    expect(verifyManifest(manifest, SECRET)).toBe(true);
  });

  it("rejects a manifest with wrong secret", () => {
    const manifest = buildManifest({
      domain: "example.com",
      businessId: "biz-789",
      businessName: "Test",
      secretKey: SECRET,
      accounts: [
        { platform: "youtube", handle: "@ch", verificationToken: "T", followerCount: 1000, verifiedAt: "" },
      ],
    });

    expect(verifyManifest(manifest, "wrong-secret")).toBe(false);
  });

  it("rejects a tampered manifest", () => {
    const manifest = buildManifest({
      domain: "example.com",
      businessId: "biz-789",
      businessName: "Test",
      secretKey: SECRET,
      accounts: [
        { platform: "youtube", handle: "@ch", verificationToken: "T", followerCount: 1000, verifiedAt: "" },
      ],
    });

    manifest.business_name = "TAMPERED";
    expect(verifyManifest(manifest, SECRET)).toBe(false);
  });
});
