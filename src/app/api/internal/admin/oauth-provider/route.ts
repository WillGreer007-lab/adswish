import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/admin/audit-log";

const GOOGLE_FLAG = "google_oauth_enabled";

/**
 * Superadmin-only control for the Google OAuth sign-in button.
 *   GET  /api/internal/admin/oauth-provider  → current state
 *   POST /api/internal/admin/oauth-provider  → { provider, enabled }
 *
 * The flag is stored in app_settings (public-read, service-role-write) and is
 * read by the login/signup pages so the button only goes live after an admin
 * flips it — which should follow registering the redirect URI in Google Cloud.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("app_settings")
    .select("value")
    .eq("key", GOOGLE_FLAG)
    .maybeSingle();

  return NextResponse.json({ provider: "google", enabled: data?.value === "true" });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { provider, enabled } = (await request.json().catch(() => ({}))) as {
    provider?: string;
    enabled?: boolean;
  };
  if (provider !== "google") {
    return NextResponse.json({ error: "Only 'google' is supported" }, { status: 400 });
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from("app_settings").upsert(
    { key: GOOGLE_FLAG, value: enabled ? "true" : "false", updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    adminId: user.id,
    actionType: "toggle_oauth_provider",
    metadata: { provider, enabled: Boolean(enabled) },
  });

  return NextResponse.json({ provider: "google", enabled: Boolean(enabled) });
}
