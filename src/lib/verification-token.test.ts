import { describe, it, expect } from "vitest";
import {
  deriveVerificationToken,
  generateCampaignToken,
  verifyCampaignToken,
  generateBioCode,
} from "@/lib/verification-token";

describe("deriveVerificationToken", () => {
  it("is stable for a user+platform and formats as ADSWISH-XXXXXX", () => {
    process.env.JWT_SIGNING_SECRET = "test-secret";
    const a = deriveVerificationToken("user-1", "instagram");
    const b = deriveVerificationToken("user-1", "instagram");
    expect(a).toBe(b);
    expect(a).toMatch(/^ADSWISH-[A-Z0-9]{6}$/);
  });

  it("differs per platform for the same user", () => {
    process.env.JWT_SIGNING_SECRET = "test-secret";
    expect(deriveVerificationToken("user-1", "instagram")).not.toBe(
      deriveVerificationToken("user-1", "twitter"),
    );
    expect(deriveVerificationToken("user-1", "tiktok")).not.toBe(
      deriveVerificationToken("user-1", "youtube"),
    );
  });

  it("differs per user for the same platform", () => {
    process.env.JWT_SIGNING_SECRET = "test-secret";
    expect(deriveVerificationToken("user-1", "twitter")).not.toBe(
      deriveVerificationToken("user-2", "twitter"),
    );
  });
});

describe("generateCampaignToken", () => {
  const secret = "test-campaign-secret";

  it("generates a valid token with correct format", () => {
    const result = generateCampaignToken("biz-123", "youtube", "@channel", secret);
    expect(result.display_code).toMatch(/^VERIFY-[A-Z0-9]{2,6}(-[A-Z0-9]{0,4})?-C-YO-[a-z0-9]{8}$/);
    expect(result.full_token).toMatch(/^VERIFY-/);
    expect(result.signature).toHaveLength(32);
    expect(result.payload.platform).toBe("youtube");
    expect(result.payload.handle).toBe("@channel");
    expect(result.payload.business_id).toBe("biz-123");
  });

  it("generates different tokens for different platforms", () => {
    const yt = generateCampaignToken("biz-123", "youtube", "@ch", secret);
    const ig = generateCampaignToken("biz-123", "instagram", "@ch", secret);
    expect(yt.display_code).not.toBe(ig.display_code);
    expect(yt.signature).not.toBe(ig.signature);
  });

  it("sets expiry 7 days from now", () => {
    const result = generateCampaignToken("biz-123", "twitter", "@x", secret);
    const expiresAt = new Date(result.expires_at).getTime();
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThan(now + sevenDaysMs - 5000);
    expect(expiresAt).toBeLessThan(now + sevenDaysMs + 5000);
  });
});

describe("verifyCampaignToken", () => {
  const secret = "verify-test-secret";

  it("verifies a valid token", () => {
    const result = generateCampaignToken("biz-456", "tiktok", "@tiktok", secret);
    const verification = verifyCampaignToken(result.full_token, result.signature, secret);
    expect(verification.valid).toBe(true);
    expect(verification.expired).toBe(false);
    expect(verification.tampered).toBe(false);
    expect(verification.platform).toBe("tiktok");
    expect(verification.handle).toBe("@tiktok");
  });

  it("rejects a tampered signature", () => {
    const result = generateCampaignToken("biz-456", "youtube", "@yt", secret);
    const verification = verifyCampaignToken(result.full_token, "tampered-signature", secret);
    expect(verification.valid).toBe(false);
    expect(verification.tampered).toBe(true);
  });

  it("rejects an expired token", () => {
    const result = generateCampaignToken("biz-456", "instagram", "@ig", secret);
    // Manually set expired timestamp in the token payload
    const body = result.full_token.replace("VERIFY-", "");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    payload.expires_at = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const expiredToken = "VERIFY-" + Buffer.from(JSON.stringify(payload)).toString("base64url");
    const verification = verifyCampaignToken(expiredToken, result.signature, secret);
    expect(verification.valid).toBe(false);
    expect(verification.expired).toBe(true);
  });
});

describe("generateBioCode", () => {
  it("returns the same format as deriveVerificationToken", () => {
    process.env.JWT_SIGNING_SECRET = "bio-test";
    const code = generateBioCode("user-1", "youtube");
    expect(code).toMatch(/^ADSWISH-[A-Z0-9]{6}$/);
    expect(code).toBe(deriveVerificationToken("user-1", "youtube"));
  });
});
