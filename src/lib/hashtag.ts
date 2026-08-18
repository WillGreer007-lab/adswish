/**
 * Hashtag verification for deliverable submissions (blueprint §9).
 *
 * v1 checks the post's real oEmbed metadata (title + author) for the required
 * hashtag instead of trusting the submitted URL string. If oEmbed is
 * unavailable for the platform, it falls back to the substring check — the
 * blueprint explicitly allows flag-for-manual-review rather than hard failure.
 */

export interface HashtagCheck {
  found: boolean;
  method: "oembed" | "fallback";
}

type OEmbedEndpoint = (url: string) => string;

const OEMBED_ENDPOINTS: Record<string, OEmbedEndpoint> = {
  "tiktok.com": (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
  "instagram.com": (u) => `https://api.instagram.com/oembed?url=${encodeURIComponent(u)}`,
  "youtube.com": (u) =>
    `https://www.youtube.com/oembed?url=${encodeURIComponent(u)}&format=json`,
  "youtu.be": (u) =>
    `https://www.youtube.com/oembed?url=${encodeURIComponent(u)}&format=json`,
  "twitter.com": (u) => `https://publish.twitter.com/oembed?url=${encodeURIComponent(u)}`,
  "x.com": (u) => `https://publish.twitter.com/oembed?url=${encodeURIComponent(u)}`,
};

export async function verifyHashtag(
  url: string,
  hashtag: string | null | undefined,
): Promise<HashtagCheck> {
  // No hashtag requirement → nothing to verify.
  if (!hashtag) return { found: true, method: "fallback" };

  const bare = hashtag.replace(/^#/, "").trim().toLowerCase();
  if (!bare) return { found: true, method: "fallback" };

  const fallback = (): HashtagCheck => ({
    found:
      url.toLowerCase().includes(bare) ||
      url.toLowerCase().includes(hashtag.toLowerCase()),
    method: "fallback",
  });

  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return fallback();
  }

  const platform = Object.keys(OEMBED_ENDPOINTS).find(
    (d) => host === d || host.endsWith(`.${d}`),
  );
  if (!platform) return fallback();

  try {
    const res = await fetch(OEMBED_ENDPOINTS[platform](url), {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return fallback();

    const data = (await res.json()) as { title?: string; author_name?: string };
    const haystack = `${data.title ?? ""} ${data.author_name ?? ""}`.toLowerCase();
    return { found: haystack.includes(bare), method: "oembed" };
  } catch {
    return fallback();
  }
}
