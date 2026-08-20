import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addTrackingTemplate, getCampaignRecord, logActivity } from "@/lib/google-ads/campaigns";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const record = await getCampaignRecord(user.id, id);
  if (!record) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const origin = new URL(request.url).origin;
  const templateUrl = `${origin}/t/{slug}?parallel=1`;
  const finalUrlSuffix = `&utm_source=adswish&utm_medium=creator&utm_campaign=${id}`;

  const ok = await addTrackingTemplate(user.id, id, templateUrl, finalUrlSuffix);
  if (!ok) return NextResponse.json({ error: "Could not inject tracking" }, { status: 500 });

  await logActivity(user.id, "success", "Parallel tracking template injected", id);
  return NextResponse.json({
    ok: true,
    template_url: templateUrl,
    final_url_suffix: finalUrlSuffix,
    parallel_tracking_enabled: true,
  });
}
