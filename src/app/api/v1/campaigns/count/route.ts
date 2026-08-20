import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * Public count of active (non-deleted) campaigns. Used by the landing page to
 * decide whether to show the "Live campaigns" section — only at 100+ active
 * campaigns, so the homepage never renders fabricated examples.
 */
export async function GET() {
  const supabase = createSupabaseServiceRoleClient();
  const { count } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .is("deleted_at", null);

  return NextResponse.json(
    { active: count ?? 0 },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
