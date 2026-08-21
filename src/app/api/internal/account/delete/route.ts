import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/account/delete
 *
 * Self-service account deletion. Mirrors the blueprint rules:
 *   - Creators cannot delete while they have a positive available balance or
 *     pending-hold conversions — they must clear holds / take a final payout.
 *   - Businesses cannot delete while a pre-paid balance remains.
 *   - Reviews are GDPR-anonymised: the reviewer identity is redacted (FK → NULL,
 *     written feedback cleared) while the 1–5 rating + date are retained for
 *     aggregate marketplace statistics.
 *   - The deletion is recorded in `deletion_requests` (survives the user delete).
 *   - The auth user is hard-deleted by the service role, cascading personal rows.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createSupabaseServiceRoleClient();
  const role = user.user_metadata?.role as string | undefined;
  const blockers: string[] = [];

  if (role === "creator") {
    // A creator's cut lives on conversions, reached via their tracking links.
    const { data: links } = await service
      .from("tracking_links")
      .select("id")
      .eq("creator_id", user.id);

    if ((links?.length ?? 0) > 0) {
      const linkIds = links!.map((l: { id: string }) => l.id);
      const { data: pending } = await service
        .from("conversions")
        .select("id")
        .in("tracking_link_id", linkIds)
        .eq("status", "pending_hold");
      if ((pending?.length ?? 0) > 0) {
        blockers.push("You have pending-hold earnings — wait for holds to release and take a final payout first.");
      }
    }
  } else if (role === "business") {
    const { data: biz } = await service
      .from("business_profiles")
      .select("balance_cents")
      .eq("user_id", user.id)
      .maybeSingle();
    const balance = Number(biz?.balance_cents ?? 0);
    if (balance > 0) {
      blockers.push(
        `You have a £${(balance / 100).toFixed(2)} pre-paid balance — cash out or spend it before deleting your account.`,
      );
    }
  }

  if (blockers.length > 0) {
    await service.from("deletion_requests").insert({
      user_id: user.id,
      email: user.email,
      role: role ?? "unknown",
      blockers,
      status: "rejected",
    });
    return NextResponse.json({ error: "Account deletion blocked", blockers }, { status: 409 });
  }

  // GDPR: redact reviews authored by this user (identity + feedback cleared,
  // numerical rating + date retained).
  await service
    .from("reviews")
    .update({ reviewer_id: null, written_feedback: null })
    .eq("reviewer_id", user.id);

  // Any reviews ABOUT this user lose the subject identity too (SET NULL FK).
  await service
    .from("reviews")
    .update({ reviewee_id: null })
    .eq("reviewee_id", user.id);

  // Record the completed deletion (no FK → survives the hard delete below).
  await service.from("deletion_requests").insert({
    user_id: user.id,
    email: user.email,
    role: role ?? "unknown",
    blockers,
    status: "completed",
    completed_at: new Date().toISOString(),
  });

  // Hard-delete the auth user; profiles/campaigns/etc. cascade.
  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json(
      { error: `Account marked for deletion but user delete failed: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, deleted: true });
}
