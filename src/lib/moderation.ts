/**
 * Content moderation for deliverable submissions (Phase 3).
 *
 * v1 uses Sightengine (pay-per-request). When the API keys are not configured
 * the check is skipped — moderation is an "auto-flag, never auto-reject" step,
 * so a missing/unavailable service must not block submissions.
 */

export interface ModerationResult {
  flagged: boolean;
  provider: "sightengine" | "none";
  reason?: string;
  error?: string;
}

export function moderationConfigured(): boolean {
  return Boolean(
    process.env.SIGHTENGINE_API_USER && process.env.SIGHTENGINE_API_KEY,
  );
}

export async function moderateContent(url: string): Promise<ModerationResult> {
  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_KEY;

  if (!apiUser || !apiSecret) {
    return { flagged: false, provider: "none" };
  }

  try {
    const params = new URLSearchParams({
      url,
      models: "nudity-2.1,wad,offensive,text-content",
      api_user: apiUser,
      api_secret: apiSecret,
    });

    const res = await fetch(
      `https://api.sightengine.com/1.0/check.json?${params.toString()}`,
      { method: "GET", signal: AbortSignal.timeout(15000) },
    );

    if (!res.ok) {
      return {
        flagged: false,
        provider: "sightengine",
        error: `HTTP ${res.status}`,
      };
    }

    const data = await res.json();

    const nudityScore = Math.max(
      data?.nudity?.sexual_activity ?? 0,
      data?.nudity?.suggestive ?? 0,
      data?.nudity?.raw ?? 0,
    );
    const offensiveScore = data?.offensive?.prob ?? 0;
    const hasProfanity =
      Array.isArray(data?.text?.profanity) && data.text.profanity.length > 0;

    const flagged =
      nudityScore > 0.6 || offensiveScore > 0.6 || hasProfanity;

    return {
      flagged,
      provider: "sightengine",
      reason: flagged ? "Explicit, offensive, or copyrighted content detected" : undefined,
    };
  } catch (err) {
    // Moderation failure must never reject a submission — surface the error so
    // the caller can fall back to manual review.
    return {
      flagged: false,
      provider: "sightengine",
      error: err instanceof Error ? err.message : "Moderation request failed",
    };
  }
}
