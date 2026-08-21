import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchYouTubeSubscriberCount, fetchYouTubeChannel, deriveYouTubeChallengeCode } from "@/lib/youtube";

beforeEach(() => {
  process.env.YOUTUBE_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchYouTubeSubscriberCount", () => {
  it("returns the subscriber count resolved by handle", async () => {
    vi.stubGlobal("fetch", async (url: unknown) => {
      const u = String(url);
      if (u.includes("forHandle")) {
        return { ok: true, json: async () => ({ items: [{ statistics: { subscriberCount: "482000" } }] }) };
      }
      throw new Error("unexpected " + u);
    });

    expect(await fetchYouTubeSubscriberCount("@somechannel")).toBe(482000);
  });

  it("falls back to forUsername when the handle doesn't resolve", async () => {
    vi.stubGlobal("fetch", async (url: unknown) => {
      const u = String(url);
      if (u.includes("forHandle")) return { ok: true, json: async () => ({ items: [] }) };
      if (u.includes("forUsername")) {
        return { ok: true, json: async () => ({ items: [{ statistics: { subscriberCount: "12345" } }] }) };
      }
      throw new Error("unexpected " + u);
    });

    expect(await fetchYouTubeSubscriberCount("legacychannel")).toBe(12345);
  });

  it("returns null and never calls the API when the key is missing", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(await fetchYouTubeSubscriberCount("@x")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null when no channel is found", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ items: [] }) }));

    expect(await fetchYouTubeSubscriberCount("@nobody")).toBeNull();
  });
});

describe("fetchYouTubeChannel", () => {
  it("returns the live description alongside the subscriber count", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      json: async () => ({
        items: [
          {
            statistics: { subscriberCount: "9000000" },
            snippet: { description: "Fitness channel. ADSWISH-A1B2C3" },
          },
        ],
      }),
    }));

    const channel = await fetchYouTubeChannel("@bigchannel");
    expect(channel.subscriberCount).toBe(9000000);
    expect(channel.description).toContain("ADSWISH-A1B2C3");
  });

  it("returns an empty description when the channel has no About text", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      json: async () => ({ items: [{ statistics: { subscriberCount: "50" } }] }),
    }));

    const channel = await fetchYouTubeChannel("@minimal");
    expect(channel.subscriberCount).toBe(50);
    expect(channel.description).toBe("");
  });
});

describe("deriveYouTubeChallengeCode", () => {
  it("is stable for a given user and formats as ADSWISH-XXXXXX", async () => {
    process.env.JWT_SIGNING_SECRET = "test-secret";
    const a = deriveYouTubeChallengeCode("user-123");
    const b = deriveYouTubeChallengeCode("user-123");
    expect(a).toBe(b);
    expect(a).toMatch(/^ADSWISH-[A-Z0-9]{6}$/);
  });

  it("differs between users", async () => {
    process.env.JWT_SIGNING_SECRET = "test-secret";
    expect(deriveYouTubeChallengeCode("user-1")).not.toBe(deriveYouTubeChallengeCode("user-2"));
  });
});
