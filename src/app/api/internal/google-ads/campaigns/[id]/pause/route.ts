import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getConnection, getValidAccessToken } from "@/lib/google-ads/connection";
import { GoogleAdsNotConfiguredError, updateGoogleAdsCampaignStatus } from "@/lib/google-ads/client";
import { getCampaignRecord, setCampaignStatus, logActivity } from "@/lib/google-ads/campaigns";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const record = await getCampaignRecord(user.id, id);
  if (!record) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const googleCampaignId = record.google_campaign_id as string | null;
  let liveUpdated = false;
  if (googleCampaignId) {
    try {
      const token = await getValidAccessToken(user.id);
      const conn = await getConnection(user.id);
      if (token && conn?.google_customer_id) {
        await updateGoogleAdsCampaignStatus(token, conn.google_customer_id, googleCampaignId, "PAUSED");
        liveUpdated = true;
      }
    } catch (err) {
      const message =
        err instanceof GoogleAdsNotConfiguredError
          ? "Pausing in Google needs the developer token — campaign paused locally only."
          : err instanceof Error ? err.message : "Google Ads pause failed";
      await setCampaignStatus(user.id, id, "paused");
      await logActivity(user.id, "warning", message, id);
      return NextResponse.json({ ok: true, status: "paused", note: message });
    }
  }

  await setCampaignStatus(user.id, id, "paused");
  await logActivity(user.id, liveUpdated ? "success" : "info", "Campaign paused", id);
  return NextResponse.json({ ok: true, status: "paused" });
}
