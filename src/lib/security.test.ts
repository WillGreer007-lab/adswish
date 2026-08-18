import { describe, it, expect } from "vitest";
import {
  filterPII,
  detectSpam,
  isAllCaps,
  isWhitelistedUrl,
} from "@/lib/security";

describe("PII filtering", () => {
  it("masks email addresses", () => {
    const result = filterPII("Contact me at john@example.com");
    expect(result.filtered).toBe("Contact me at [REDACTED]");
    expect(result.detected).toBe(true);
    expect(result.detectedTypes).toContain("email");
  });

  it("masks phone numbers", () => {
    const result = filterPII("Call me at +1-555-123-4567");
    expect(result.detected).toBe(true);
    expect(result.detectedTypes).toContain("phone");
  });

  it("masks non-whitelisted URLs", () => {
    const result = filterPII("Check https://evil.com for details");
    expect(result.detected).toBe(true);
    expect(result.detectedTypes).toContain("url");
  });

  it("does not mask whitelisted platform URLs", () => {
    const result = filterPII("See my tiktok.com/@creator profile");
    expect(result.detected).toBe(false);
  });

  it("returns clean text unchanged", () => {
    const result = filterPII("This is a clean message about campaigns");
    expect(result.detected).toBe(false);
    expect(result.filtered).toBe("This is a clean message about campaigns");
  });
});

describe("Spam detection", () => {
  it("detects repeated messages", () => {
    expect(detectSpam(["hello", "hello", "hello"])).toBe(true);
  });

  it("does not flag varied messages", () => {
    expect(detectSpam(["hello", "world", "foo"])).toBe(false);
  });

  it("does not flag short sequences", () => {
    expect(detectSpam(["hello", "hello"])).toBe(false);
  });
});

describe("All caps detection", () => {
  it("detects all caps messages", () => {
    expect(isAllCaps("THIS IS A SHOUTING MESSAGE!!!")).toBe(true);
  });

  it("does not flag normal text", () => {
    expect(isAllCaps("This is a normal message")).toBe(false);
  });

  it("does not flag short messages", () => {
    expect(isAllCaps("HI")).toBe(false);
  });
});

describe("Whitelisted URL check", () => {
  it("allows tiktok.com", () => {
    expect(isWhitelistedUrl("https://tiktok.com/@creator")).toBe(true);
  });

  it("allows subdomains of tiktok.com", () => {
    expect(isWhitelistedUrl("https://www.tiktok.com/@creator")).toBe(true);
  });

  it("rejects non-whitelisted domains", () => {
    expect(isWhitelistedUrl("https://evil.com")).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(isWhitelistedUrl("not a url")).toBe(false);
  });
});
