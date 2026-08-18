import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const NOTIFICATION_TYPES = [
  "payment",
  "application",
  "sla",
  "pixel_offline",
  "review",
  "message",
  "system",
] as const;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("muted_types, email_enabled, push_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    muted_types: data?.muted_types ?? [],
    email_enabled: data?.email_enabled ?? true,
    push_enabled: data?.push_enabled ?? true,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (Array.isArray(body?.muted_types)) {
    update.muted_types = (body.muted_types as string[]).filter((t) =>
      (NOTIFICATION_TYPES as readonly string[]).includes(t),
    );
  }
  if (typeof body?.email_enabled === "boolean") update.email_enabled = body.email_enabled;
  if (typeof body?.push_enabled === "boolean") update.push_enabled = body.push_enabled;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: user.id, ...update }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
