import { deriveVerificationToken } from "@/lib/verification-token";

/**
 * No-OAuth YouTube verification.
 *
 * The YouTube Data API v3 returns a public channel's subscriber count AND its
 * public "About" description with a plain API key — no OAuth consent screen,
 * no user login. We use the description as an ownership proof: a creator must
 * paste a per-account challenge code into their channel's About section, and we
 * only auto-verify when the live description contains it. This stops anyone
 * from claiming a famous channel they don't control.
 */

const API = "https://www.googleapis.com/youtube/v3/channels";

export interface YouTubeChannel {
  subscriberCount: number | null;
  description: string;
}

/**
 * A stateless, per-user challenge code the creator pastes into their YouTube
 * channel description. Derived from the JWT signing secret + user id, so it is
 * stable (the creator can paste it once) without any database storage.
 */
export function deriveYouTubeChallengeCode(userId: string): string {
  return deriveVerificationToken(userId, "youtube");
}

/**
 * Resolve a channel's live subscriber count + public description by handle
 * (with a legacy-username fallback). Returns nulls/empty on missing key,
 * not-found, or API errors — callers treat null as "skip / not available".
 */
export async function fetchYouTubeChannel(handle: string): Promise<YouTubeChannel> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { subscriberCount: null, description: "" };

  const clean = (handle ?? "").trim().replace(/^@/, "");
  if (!clean) return { subscriberCount: null, description: "" };

  const empty: YouTubeChannel = { subscriberCount: null, description: "" };

  const byHandle = new URLSearchParams({ part: "snippet,statistics", key, forHandle: `@${clean}` });
  let res = await fetch(`${API}?${byHandle}`);
  if (!res.ok) return empty;
  let json = await res.json();
  let item = json?.items?.[0];

  if (!item) {
    // Legacy channels (or handles that don't resolve) — try forUsername.
    const byUsername = new URLSearchParams({ part: "snippet,statistics", key, forUsername: clean });
    res = await fetch(`${API}?${byUsername}`);
    if (!res.ok) return empty;
    json = await res.json();
    item = json?.items?.[0];
  }

  const count = parseInt(item?.statistics?.subscriberCount || "0", 10);
  return {
    subscriberCount: count > 0 ? count : null,
    description: item?.snippet?.description ?? "",
  };
}

/**
 * Convenience wrapper used by the follower re-check and admin approval path
 * (which only need the count).
 */
export async function fetchYouTubeSubscriberCount(handle: string): Promise<number | null> {
  const { subscriberCount } = await fetchYouTubeChannel(handle);
  return subscriberCount;
}
