import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchYouTubeChannel, deriveYouTubeChallengeCode } from "@/lib/youtube";
import { getCreatorTier } from "@/lib/tier";

/**
 * POST /api/internal/oauth/youtube/verify  { handle }
 *
 * Self-serve YouTube verification with an ownership proof: the creator must
 * paste their per-account challenge code into the channel's public About
 * description. We fetch the live description (plain API key — no OAuth) and
 * only verify when it contains the code, so nobody can claim a channel they
 * don't control. No screenshot and no admin approval needed.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const handle = typeof body?.handle === "string" ? body.handle.trim() : "";
  if (!handle) {
    return NextResponse.json({ error: "A YouTube handle is required" }, { status: 422 });
  }

  const channel = await fetchYouTubeChannel(handle);
  if (channel.subscriberCount === null) {
    return NextResponse.json(
      {
        error:
          "Couldn't find that YouTube channel (or the YouTube API key isn't configured yet). " +
          "Check the handle and try again, or upload a screenshot for manual verification.",
      },
      { status: 422 },
    );
  }

  // Ownership proof: the live channel description must contain this user's
  // challenge code. If not, hand the code back so the UI can guide them.
  const code = deriveYouTubeChallengeCode(user.id);
  if (!channel.description.toUpperCase().includes(code)) {
    return NextResponse.json(
      {
        error: "We need to confirm you own this channel before verifying it.",
        code,
        needs_bio_proof: true,
        handle: handle.replace(/^@/, ""),
      },
      { status: 403 },
    );
  }

  const service = createSupabaseServiceRoleClient();

  const { error: upsertError } = await service
    .from("creator_social_accounts")
    .upsert(
      {
        creator_id: user.id,
        platform: "youtube",
        handle: handle.replace(/^@/, ""),
        follower_count: channel.subscriberCount,
        verified_at: new Date().toISOString(),
        disconnected_at: null,
      },
      { onConflict: "creator_id,platform" },
    );
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  // Recompute tier from the max verified follower count across all socials.
  let tier: string | null = null;
  const { data: socials } = await service
    .from("creator_social_accounts")
    .select("follower_count")
    .eq("creator_id", user.id)
    .not("verified_at", "is", null);
  const maxFollowers = Math.max(0, ...(socials ?? []).map((s: any) => Number(s.follower_count ?? 0)));
  tier = getCreatorTier(maxFollowers);

  if (tier) {
    const { data: profile } = await service
      .from("creator_profiles")
      .select("tier")
      .eq("user_id", user.id)
      .single();
    await service
      .from("creator_profiles")
      .update({
        tier,
        previous_tier: profile?.tier ?? tier,
        tier_changed_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
  }

  try {
    const { refreshCreatorBadges } = await import("@/lib/badges");
    await refreshCreatorBadges(user.id);
  } catch {
    /* the daily badges cron reconciles drift */
  }

  return NextResponse.json({
    ok: true,
    handle: handle.replace(/^@/, ""),
    follower_count: channel.subscriberCount,
    tier,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
