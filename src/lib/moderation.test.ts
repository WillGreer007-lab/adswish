import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { moderationConfigured, moderateContent } from "./moderation";

describe("moderation", () => {
  const original = {
    user: process.env.SIGHTENGINE_API_USER,
    key: process.env.SIGHTENGINE_API_KEY,
  };

  beforeEach(() => {
    delete process.env.SIGHTENGINE_API_USER;
    delete process.env.SIGHTENGINE_API_KEY;
  });

  afterEach(() => {
    process.env.SIGHTENGINE_API_USER = original.user;
    process.env.SIGHTENGINE_API_KEY = original.key;
    vi.restoreAllMocks();
  });

  it("is not configured without keys", () => {
    expect(moderationConfigured()).toBe(false);
  });

  it("is configured when both keys are present", () => {
    process.env.SIGHTENGINE_API_USER = "123";
    process.env.SIGHTENGINE_API_KEY = "secret";
    expect(moderationConfigured()).toBe(true);
  });

  it("skips the check (provider: none) when keys are missing", async () => {
    const result = await moderateContent("https://example.com/video");
    expect(result).toEqual({ flagged: false, provider: "none" });
  });

  it("flags explicit content when Sightengine reports high nudity", async () => {
    process.env.SIGHTENGINE_API_USER = "123";
    process.env.SIGHTENGINE_API_KEY = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          nudity: { sexual_activity: 0.9 },
          offensive: { prob: 0.1 },
          text: { profanity: [] },
        }),
      }),
    );

    const result = await moderateContent("https://example.com/video");
    expect(result.flagged).toBe(true);
    expect(result.provider).toBe("sightengine");
  });

  it("returns clean for benign content", async () => {
    process.env.SIGHTENGINE_API_USER = "123";
    process.env.SIGHTENGINE_API_KEY = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          nudity: { sexual_activity: 0.01 },
          offensive: { prob: 0.01 },
          text: { profanity: [] },
        }),
      }),
    );

    const result = await moderateContent("https://example.com/video");
    expect(result.flagged).toBe(false);
  });

  it("never flags when the moderation service is down", async () => {
    process.env.SIGHTENGINE_API_USER = "123";
    process.env.SIGHTENGINE_API_KEY = "secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const result = await moderateContent("https://example.com/video");
    expect(result.flagged).toBe(false);
    expect(result.provider).toBe("sightengine");
    expect(result.error).toBe("network down");
  });
});
