import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getKillSwitch, saveKillSwitch } from "@/lib/google-ads/campaigns";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ killSwitch: await getKillSwitch(user.id) });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

  const settings = {
    maxDaily: num(body.maxDaily),
    maxTotal: num(body.maxTotal),
    minConversions: num(body.minConversions),
    minRoas: num(body.minRoas),
  };

  await saveKillSwitch(user.id, settings);
  return NextResponse.json({ ok: true, killSwitch: settings });
}
