import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getConnection } from "@/lib/google-ads/connection";
import { getKillSwitch } from "@/lib/google-ads/campaigns";
import { isGoogleAdsConfigured } from "@/lib/google-ads/oauth";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await getConnection(user.id);

  return NextResponse.json({
    configured: isGoogleAdsConfigured(),
    connected: Boolean(conn && conn.status === "active"),
    customerId: conn?.google_customer_id ?? null,
    scopes: conn?.scopes ?? [],
    killSwitch: await getKillSwitch(user.id),
  });
}
