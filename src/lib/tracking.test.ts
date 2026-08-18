// @vitest-environment node
import { describe, it, expect } from "vitest";
import { signTrackingJwt, verifyTrackingJwt, sha256Hex } from "@/lib/tracking";

const BASE = {
  linkId: "11111111-1111-1111-1111-111111111111",
  creatorId: "22222222-2222-2222-2222-222222222222",
  campaignId: "33333333-3333-3333-3333-333333333333",
  deliverableId: "44444444-4444-4444-4444-444444444444",
  ipHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  uaHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("tracking JWT", () => {
  it("round-trips all attribution claims", async () => {
    const token = await signTrackingJwt({ ...BASE, jti: "jti-1", ttlSeconds: 60 });
    const claims = await verifyTrackingJwt(token);

    expect(claims.linkId).toBe(BASE.linkId);
    expect(claims.creatorId).toBe(BASE.creatorId);
    expect(claims.campaignId).toBe(BASE.campaignId);
    expect(claims.deliverableId).toBe(BASE.deliverableId);
    expect(claims.ipHash).toBe(BASE.ipHash);
    expect(claims.uaHash).toBe(BASE.uaHash);
    expect(claims.jti).toBe("jti-1");
    expect(claims.exp - claims.iat).toBe(60);
  });

  it("rejects an expired token", async () => {
    const token = await signTrackingJwt({ ...BASE, jti: "jti-2", ttlSeconds: -1 });
    await expect(verifyTrackingJwt(token)).rejects.toThrow();
  });

  it("rejects a tampered token", async () => {
    const token = await signTrackingJwt({ ...BASE, jti: "jti-3", ttlSeconds: 60 });
    const tampered = token.slice(0, -4) + (token.endsWith("aaaa") ? "bbbb" : "aaaa");
    await expect(verifyTrackingJwt(tampered)).rejects.toThrow();
  });

  it("allows a null deliverable (pure affiliate links)", async () => {
    const token = await signTrackingJwt({
      ...BASE,
      deliverableId: null,
      jti: "jti-4",
      ttlSeconds: 60,
    });
    const claims = await verifyTrackingJwt(token);
    expect(claims.deliverableId).toBeNull();
  });
});

describe("sha256Hex", () => {
  it("is deterministic and non-reversible", async () => {
    expect(await sha256Hex("1.2.3.4")).toBe(await sha256Hex("1.2.3.4"));
    expect(await sha256Hex("1.2.3.4")).not.toBe(await sha256Hex("1.2.3.5"));
    expect(await sha256Hex("1.2.3.4")).not.toContain("1.2.3.4");
  });
});
