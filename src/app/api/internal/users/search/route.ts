import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * GET /api/internal/users/search?q=…
 * Search creators and businesses by display/company name. Used by the
 * "add a friend" search in Messages.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const service = createSupabaseServiceRoleClient();
  const pattern = `%${q.replace(/[%_]/g, "\\$&")}%`;

  const [creators, businesses] = await Promise.all([
    service
      .from("creator_profiles")
      .select("user_id, display_name, profile_picture_url, niches, tier")
      .ilike("display_name", pattern)
      .is("deleted_at", null)
      .limit(15),
    service
      .from("business_profiles")
      .select("user_id, company_name, logo_url, verified_domain")
      .ilike("company_name", pattern)
      .is("deleted_at", null)
      .limit(15),
  ]);

  const results = [
    ...(creators.data ?? []).map((c: any) => ({
      id: c.user_id,
      name: c.display_name,
      role: "creator",
      avatar: c.profile_picture_url,
      meta: (c.niches ?? []).slice(0, 3).join(", ") || c.tier,
    })),
    ...(businesses.data ?? []).map((b: any) => ({
      id: b.user_id,
      name: b.company_name,
      role: "business",
      avatar: b.logo_url,
      meta: b.verified_domain ?? "",
    })),
  ].filter((r) => r.id !== user.id);

  return NextResponse.json({ results });
}
