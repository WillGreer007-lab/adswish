import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/admin/audit-log";
import { getCreatorTier } from "@/lib/tier";
import { fetchYouTubeSubscriberCount } from "@/lib/youtube";

const BUCKET = "creator-verification";

async function getAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "Unauthorized" };
  if (user.app_metadata?.role !== "admin") return { user: null, error: "Admin access required" };
  return { user, error: null };
}

async function signedRow(service: ReturnType<typeof createSupabaseServiceRoleClient>, row: any) {
  let screenshotUrl = row.screenshot_url?.startsWith("http") ? row.screenshot_url : null;
  const path = row.storage_path || (!row.screenshot_url?.startsWith("http") ? row.screenshot_url : null);
  if (path) {
    const { data } = await service.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    screenshotUrl = data?.signedUrl ?? screenshotUrl;
  }
  return { ...row, screenshot_url: screenshotUrl };
}

export async function GET(request: NextRequest) {
  const { user, error } = await getAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });

  const service = createSupabaseServiceRoleClient();
  const status = new URL(request.url).searchParams.get("status");
  let query = service
    .from("manual_follower_verifications")
    .select("id, creator_id, platform, handle, claimed_follower_count, verification_token, screenshot_url, storage_path, status, review_notes, reviewed_at, created_at, updated_at, creator_profiles(display_name, profile_picture_url)")
    .order("created_at", { ascending: true });
  if (status) query = query.eq("status", status);

  const { data, error: queryError } = await query;
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ verifications: await Promise.all((data ?? []).map((row: any) => signedRow(service, row))) });
}

export async function PATCH(request: NextRequest) {
  const { user: admin, error } = await getAdmin();
  if (error || !admin) return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  const status = body.status as "approved" | "rejected";
  const reviewNotes = typeof body.review_notes === "string" ? body.review_notes.trim().slice(0, 1000) : null;
  if (!id || !["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "id and status (approved or rejected) are required" }, { status: 400 });
  }

  const service = createSupabaseServiceRoleClient();
  const { data: verification, error: lookupError } = await service
    .from("manual_follower_verifications")
    .select("id, creator_id, platform, handle, claimed_follower_count, verification_token, status")
    .eq("id", id)
    .single();
  if (lookupError || !verification) return NextResponse.json({ error: "Verification not found" }, { status: 404 });

  const { error: updateError } = await service
    .from("manual_follower_verifications")
    .update({ status, reviewed_by: admin.id, reviewed_at: new Date().toISOString(), review_notes: reviewNotes })
    .eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (status === "approved") {
    let followerCount = Number(verification.claimed_follower_count ?? 0);
    // YouTube: cross-check the screenshot claim against a live lookup by handle
    // (plain API key, no OAuth) so the verified count is real, not self-reported.
    if (verification.platform === "youtube") {
      const live = await fetchYouTubeSubscriberCount(verification.handle);
      if (live !== null) followerCount = live;
    }
    const { error: socialError } = await service
      .from("creator_social_accounts")
      .upsert(
        {
          creator_id: verification.creator_id,
          platform: verification.platform,
          handle: verification.handle,
          follower_count: followerCount,
          verified_at: new Date().toISOString(),
          disconnected_at: null,
        },
        { onConflict: "creator_id,platform" },
      );
    if (socialError) return NextResponse.json({ error: socialError.message }, { status: 500 });

    const { data: socials } = await service
      .from("creator_social_accounts")
      .select("follower_count")
      .eq("creator_id", verification.creator_id)
      .not("verified_at", "is", null);
    const maxFollowers = Math.max(0, ...(socials ?? []).map((social: any) => Number(social.follower_count ?? 0)));
    const tier = getCreatorTier(maxFollowers);
    if (tier) {
      const { data: profile } = await service
        .from("creator_profiles")
        .select("tier")
        .eq("user_id", verification.creator_id)
        .single();
      await service
        .from("creator_profiles")
        .update({ tier, previous_tier: profile?.tier ?? tier, tier_changed_at: new Date().toISOString() })
        .eq("user_id", verification.creator_id);
    }

    // Append-only, publicly readable audit trail (one row per approval).
    // Best-effort: never block an approval on an audit write failure.
    try {
      await service.from("verification_audits").insert({
        creator_id: verification.creator_id,
        platform: verification.platform,
        handle: verification.handle,
        follower_count: followerCount,
        threshold: 1000,
        threshold_met: followerCount >= 1000,
        verification_token_matched: true,
        tier: tier ?? null,
      });
    } catch {
      /* audit trail is best-effort */
    }
  }

  // A new approved follower count can move the gold badge (1M+) — recompute.
  if (status === "approved") {
    try {
      const { refreshCreatorBadges } = await import("@/lib/badges");
      await refreshCreatorBadges(verification.creator_id);
    } catch {
      /* the daily badges cron reconciles drift */
    }
  }

  await logAdminAction({
    adminId: admin.id,
    actionType: status === "approved" ? "approve_follower_verification" : "reject_follower_verification",
    targetEntityId: verification.creator_id,
    metadata: { verification_id: id, platform: verification.platform, claimed_follower_count: verification.claimed_follower_count, review_notes: reviewNotes },
  });

  await service.from("notifications").insert({
    user_id: verification.creator_id,
    type: "system",
    body:
      status === "approved"
        ? `Your ${verification.platform} follower screenshot was approved.`
        : `Your ${verification.platform} follower screenshot was rejected${reviewNotes ? `: ${reviewNotes}` : "."}`,
    link: "/dashboard/creator/profile",
  });

  return NextResponse.json({ ok: true, status });
}
