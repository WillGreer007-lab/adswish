// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { verifyHashtag } from "@/lib/hashtag";

afterEach(() => vi.unstubAllGlobals());

describe("verifyHashtag", () => {
  it("passes when no hashtag is required", async () => {
    const r = await verifyHashtag("https://example.com/post", null);
    expect(r.found).toBe(true);
  });

  it("falls back to substring for non-oEmbed platforms", async () => {
    const r = await verifyHashtag(
      "https://example.com/my-AdswishAbc-post",
      "#AdswishAbc",
    );
    expect(r.found).toBe(true);
    expect(r.method).toBe("fallback");
  });

  it("verifies via oEmbed title for supported platforms", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ title: "My #AdswishCampaign post" }),
      }),
    );
    const r = await verifyHashtag(
      "https://www.tiktok.com/@user/video/123456",
      "#AdswishCampaign",
    );
    expect(r.found).toBe(true);
    expect(r.method).toBe("oembed");
  });

  it("returns false when oEmbed metadata lacks the hashtag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ title: "No hashtag here" }),
      }),
    );
    const r = await verifyHashtag(
      "https://www.youtube.com/watch?v=abc123",
      "#MissingTag",
    );
    expect(r.found).toBe(false);
    expect(r.method).toBe("oembed");
  });

  it("falls back to substring when oEmbed fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const r = await verifyHashtag(
      "https://www.instagram.com/p/AdswishTag123",
      "#AdswishTag",
    );
    expect(r.found).toBe(true);
    expect(r.method).toBe("fallback");
  });
});
