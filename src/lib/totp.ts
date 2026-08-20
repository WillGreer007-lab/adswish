import { createHmac, randomBytes } from "node:crypto";

/**
 * RFC 6238 TOTP helpers for the QR-code signup/login fallback (no email
 * needed). Mirrors what authenticator apps (Google Authenticator, Microsoft
 * Authenticator, Authy, 1Password) compute: HMAC-SHA1, 30s step, 6 digits.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Decode an (unpadded) RFC 4648 base32 string to bytes. */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[=\s]/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx < 0) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Encode bytes to an unpadded uppercase base32 string. */
export function base32Encode(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  return out;
}

/** Generate a fresh TOTP secret (160 bits by default, like standard apps). */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

/** RFC 6238 counter-based code (step = 30s, digits = 6). */
export function totpCode(
  secret: string,
  opts: { timeStep?: number; digits?: number; timestamp?: number } = {},
): string {
  const { timeStep = 30, digits = 6, timestamp = Date.now() } = opts;
  const counter = Math.floor(timestamp / 1000 / timeStep);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const key = base32Decode(secret);
  const hmac = createHmac("sha1", key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

/**
 * Verify a 6-digit code allowing `window` steps on either side (30s each).
 * Normalizes inputs and rejects empty/non-numeric codes.
 */
export function verifyTotp(
  secret: string,
  code: string,
  opts: { timeStep?: number; digits?: number; window?: number } = {},
): boolean {
  const { timeStep = 30, digits = 6, window = 1 } = opts;
  const clean = code.trim();
  if (!/^\d+$/.test(clean) || clean.length !== digits) return false;
  const now = Date.now();
  for (let i = -window; i <= window; i++) {
    const candidate = totpCode(secret, {
      timeStep,
      digits,
      timestamp: now + i * timeStep * 1000,
    });
    if (candidate === clean) return true;
  }
  return false;
}

/** Standard otpauth:// URI for authenticator apps. */
export function otpauthUri(
  email: string,
  secret: string,
  issuer = "Adswish",
): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
