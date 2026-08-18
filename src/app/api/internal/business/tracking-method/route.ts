import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const method = body?.tracking_method;
  if (method !== "script" && method !== "extension") {
    return NextResponse.json(
      { error: "tracking_method must be 'script' or 'extension'" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("business_profiles")
    .update({ tracking_method: method })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tracking_method: method });
}
