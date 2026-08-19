import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * POST /api/internal/oauth/disconnect  { platform }
 * Marks a creator's social account as disconnected (soft delete — keeps the
 * follower history) so it disappears from the profile and stops being
 * refreshed. Only the owning creator can disconnect their own account.
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
  const platform = body?.platform as string | undefined;
  if (!platform || !["tiktok", "instagram", "youtube"].includes(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 422 });
  }

  // Service-role write: RLS gives creators read/update on their own socials
  // but the disconnect write (setting disconnected_at) goes through here.
  const serviceClient = createSupabaseServiceRoleClient();
  const { data: updated, error } = await serviceClient
    .from("creator_social_accounts")
    .update({ disconnected_at: new Date().toISOString(), access_token: null, refresh_token: null, token_expires_at: null, refresh_token_expires_at: null })
    .eq("creator_id", user.id)
    .eq("platform", platform)
    .is("disconnected_at", null)
    .select("id, platform, handle, disconnected_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, disconnected: updated ?? [] });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
