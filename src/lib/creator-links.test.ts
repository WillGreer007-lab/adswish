import { describe, expect, it } from "vitest";
import { normalizeUrl, socialProfileUrl, isValidHttpUrl } from "@/lib/creator-links";

describe("normalizeUrl", () => {
  it("returns null for empty input", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl(undefined)).toBeNull();
  });

  it("prepends https:// to bare domains", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com/");
  });

  it("keeps an existing scheme", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com/");
  });

  it("rejects junk", () => {
    expect(normalizeUrl("not a url")).toBeNull();
  });
});

describe("socialProfileUrl", () => {
  it("builds per-platform URLs and strips @", () => {
    expect(socialProfileUrl("tiktok", "@sarah")).toBe("https://tiktok.com/@sarah");
    expect(socialProfileUrl("instagram", "@sarah.fit")).toBe("https://instagram.com/sarah.fit");
    expect(socialProfileUrl("youtube", "@SarahM")).toBe("https://youtube.com/@SarahM");
    expect(socialProfileUrl("twitter", "@sarah")).toBe("https://x.com/sarah");
  });

  it("returns null for empty handles or unknown platforms", () => {
    expect(socialProfileUrl("tiktok", "")).toBeNull();
    expect(socialProfileUrl("twitch", "x")).toBeNull();
  });
});

describe("isValidHttpUrl", () => {
  it("accepts http/https only", () => {
    expect(isValidHttpUrl("https://example.com")).toBe(true);
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("")).toBe(false);
  });
});
