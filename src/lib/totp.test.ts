import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUri,
  totpCode,
  verifyTotp,
} from "./totp";

// RFC 6238 Appendix B vectors (secret = ASCII "12345678901234567890").
const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

// [time in seconds, expected 6-digit code]
const VECTORS: [number, string][] = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"],
];

describe("totp", () => {
  it("produces the RFC 6238 test vectors", () => {
    for (const [timeSeconds, expected] of VECTORS) {
      expect(totpCode(SECRET, { timestamp: timeSeconds * 1000 })).toBe(expected);
    }
  });

  it("verifies the current code and rejects wrong codes", () => {
    const code = totpCode(SECRET);
    expect(verifyTotp(SECRET, code)).toBe(true);
    expect(verifyTotp(SECRET, "000000")).toBe(false);
    expect(verifyTotp(SECRET, "12345")).toBe(false); // wrong length
    expect(verifyTotp(SECRET, "abcdef")).toBe(false); // non-numeric
    expect(verifyTotp(SECRET, "")).toBe(false);
  });

  it("accepts codes within the ±window", () => {
    const now = Date.now();
    const future = totpCode(SECRET, { timestamp: now + 60_000 }); // +2 steps
    expect(verifyTotp(SECRET, future)).toBe(false); // beyond default window
    expect(verifyTotp(SECRET, future, { window: 2 })).toBe(true);
  });

  it("round-trips base32 encode/decode", () => {
    const bytes = Buffer.from("hello adswish", "utf8");
    expect(base32Decode(base32Encode(bytes)).toString("utf8")).toBe("hello adswish");
    expect(() => base32Decode("INVALID!")).toThrow();
  });

  it("generates usable secrets", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(16);
    expect(verifyTotp(secret, totpCode(secret))).toBe(true);
  });

  it("builds an otpauth URI with the right parameters", () => {
    const uri = otpauthUri("sarah@example.com", SECRET);
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("secret=" + SECRET);
    expect(uri).toContain("issuer=Adswish");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});
