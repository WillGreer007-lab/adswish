import { createHash } from "crypto";

const PII_PATTERNS = [
  { type: "email", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { type: "phone", regex: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g },
  {
    type: "url",
    regex: /https?:\/\/(?!.*(tiktok\.com|instagram\.com|youtube\.com|adswish\.com))[^\s]+/g,
  },
];

const WHITELISTED_DOMAINS = [
  "tiktok.com",
  "instagram.com",
  "youtube.com",
  "adswish.com",
];

export interface PIIDetectionResult {
  filtered: string;
  detected: boolean;
  detectedTypes: string[];
}

export function filterPII(text: string): PIIDetectionResult {
  let filtered = text;
  const detectedTypes = new Set<string>();

  for (const { type, regex } of PII_PATTERNS) {
    if (regex.test(filtered)) {
      detectedTypes.add(type);
      regex.lastIndex = 0;
      filtered = filtered.replace(regex, "[REDACTED]");
    }
  }

  return {
    filtered,
    detected: detectedTypes.size > 0,
    detectedTypes: Array.from(detectedTypes),
  };
}

export function hashIPAddress(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export function hashUserAgent(ua: string): string {
  return createHash("sha256").update(ua).digest("hex").slice(0, 16);
}

export function isWhitelistedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return WHITELISTED_DOMAINS.some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

export function detectSpam(
  messages: string[],
  threshold: number = 3,
): boolean {
  if (messages.length < threshold) return false;

  const recent = messages.slice(-threshold);
  const unique = new Set(recent.map((m) => m.trim().toLowerCase()));
  return unique.size === 1;
}

export function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 10) return false;
  return text === text.toUpperCase();
}
