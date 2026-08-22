/**
 * Creator profile link helpers: normalize/validate the self-described links
 * (website, Twitter/X, Twitch) and derive social profile URLs from the
 * connected `creator_social_accounts` handles.
 */

/** Normalize a user-supplied URL so "example.com" works as well as full URLs. */
export function normalizeUrl(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  // Allow handles/domains without a scheme; prepend https:// when missing.
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!/^https?:$/.test(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Build the public profile URL for a connected social account's handle. */
export function socialProfileUrl(platform: string, handle: string | null | undefined): string | null {
  const clean = (handle ?? "").trim().replace(/^@+/, "");
  if (!clean) return null;
  switch (platform) {
    case "tiktok":
      return `https://tiktok.com/@${clean}`;
    case "instagram":
      return `https://instagram.com/${clean}`;
    case "youtube":
      return `https://youtube.com/@${clean}`;
    case "twitter":
      return `https://x.com/${clean}`;
    default:
      return null;
  }
}

/** Whether a URL is safe to render as a clickable link. */
export function isValidHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
