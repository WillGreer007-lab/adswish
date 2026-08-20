import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Google Partner credits.
 *
 * GET  /api/internal/google-ads/partner-credits → { status, creditAmountCents, appliedAt }
 * POST /api/internal/google-ads/partner-credits → apply for the credit (idempotent)
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: credit } = await supabase
    .from("google_ads_partner_credits")
    .select("status, credit_amount_cents, applied_at, notes")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    status: credit?.status ?? "not_applied",
    creditAmountCents: Number(credit?.credit_amount_cents) || 50000,
    appliedAt: credit?.applied_at ?? null,
    notes: credit?.notes ?? null,
  });
}

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing } = await supabase
    .from("google_ads_partner_credits")
    .select("id, status, credit_amount_cents")
    .eq("user_id", user.id)
    .maybeSingle();

  // Already applied (or decided) — nothing to do; surface the current state.
  if (existing) {
    return NextResponse.json({
      ok: true,
      status: existing.status,
      creditAmountCents: Number(existing.credit_amount_cents) || 50000,
    });
  }

  const { error } = await supabase.from("google_ads_partner_credits").insert({
    user_id: user.id,
    status: "applied",
    credit_amount_cents: 50000,
    applied_at: new Date().toISOString(),
    notes: "Applied via the Google Ads dashboard.",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "applied", creditAmountCents: 50000 });
}
