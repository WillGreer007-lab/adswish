import { describe, it, expect } from "vitest";
import { deriveVerificationToken } from "@/lib/verification-token";

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
