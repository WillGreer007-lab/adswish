import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CRITICAL_INTEGRATIONS,
  OPTIONAL_INTEGRATIONS,
  integrationLimitForPlan,
} from "@/lib/integrations";
import type { SupabaseClient } from "@supabase/supabase-js";

const OPTIONAL_KEYS = new Set(OPTIONAL_INTEGRATIONS.map((i) => i.key));

/** Active plan slug for a user (creator or business subscription), else null. */
async function getPlanSlug(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const [creator, business] = await Promise.all([
    supabase
      .from("creator_subscriptions")
      .select("plan_slug")
      .eq("creator_id", userId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("business_subscriptions")
      .select("plan_slug")
      .eq("business_id", userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  return (
    (creator.data?.plan_slug as string | undefined) ??
    (business.data?.plan_slug as string | undefined) ??
    null
  );
}

/**
 * Per-user optional integrations (the plan-limited "add / remove" list).
 *
 * GET    /api/internal/integrations → { added: { key, addedAt }[] }
 * POST   { key }                    → add an integration (enforces plan limit)
 * DELETE ?key=                      → remove an integration
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: rows } = await supabase
    .from("user_integrations")
    .select("integration_key, added_at")
    .eq("user_id", user.id);

  return NextResponse.json({
    added: (rows ?? []).map((r: { integration_key: string; added_at: string }) => ({
      key: r.integration_key,
      addedAt: r.added_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { key?: string };
  const key = body.key;
  if (!key || !OPTIONAL_KEYS.has(key)) {
    return NextResponse.json({ error: "Unknown integration" }, { status: 400 });
  }

  const planSlug = await getPlanSlug(supabase, user.id);
  const limit = integrationLimitForPlan(planSlug);

  const { count } = await supabase
    .from("user_integrations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const used = CRITICAL_INTEGRATIONS.length + (count ?? 0);
  if (used >= limit) {
    return NextResponse.json(
      { error: `You've used all ${limit} integration slots on your plan.` },
      { status: 403 },
    );
  }

  const { data: existing } = await supabase
    .from("user_integrations")
    .select("integration_key")
    .eq("user_id", user.id)
    .eq("integration_key", key)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, alreadyAdded: true });
  }

  const { error } = await supabase
    .from("user_integrations")
    .insert({ user_id: user.id, integration_key: key });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, added: key, used: used + 1 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = request.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  await supabase
    .from("user_integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("integration_key", key);

  return NextResponse.json({ ok: true, removed: key });
}
