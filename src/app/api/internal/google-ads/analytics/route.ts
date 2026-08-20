import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listCampaignRecords } from "@/lib/google-ads/campaigns";

/**
 * Blended ROAS analytics. Spend/revenue come from the Ads API reporting sync
 * (needs the developer token); until then the numbers are honest zeros derived
 * from the local campaign records.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  type RecordRow = {
    id: string;
    google_campaign_name: string | null;
    goal: string;
    status: string;
    total_spend_cents: number | null;
    revenue_cents: number | null;
    conversions: number | null;
  };
  const records = (await listCampaignRecords(user.id)) as RecordRow[];

  const totals = records.reduce(
    (acc: { spendCents: number; revenueCents: number; conversions: number }, r: RecordRow) => {
      acc.spendCents += Number(r.total_spend_cents) || 0;
      acc.revenueCents += Number(r.revenue_cents) || 0;
      acc.conversions += Number(r.conversions) || 0;
      return acc;
    },
    { spendCents: 0, revenueCents: 0, conversions: 0 },
  );

  const roas = totals.spendCents > 0 ? totals.revenueCents / totals.spendCents : null;
  const costPerConversion =
    totals.conversions > 0 ? totals.spendCents / totals.conversions : null;

  // ── Organic side: conversions attributed through the user's own campaigns ──
  // (i.e. not from Google Ads). Feeds the blended ROAS view.
  type ConversionRow = { order_amount: number | string | null; created_at: string };
  let organic = { revenueCents: 0, conversions: 0, daily: [] as { date: string; revenueCents: number; conversions: number }[] };
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: businessCampaigns } = await supabase
    .from("campaigns")
    .select("id")
    .eq("business_id", user.id)
    .is("deleted_at", null);
  const campaignIds = (businessCampaigns ?? []).map((c: { id: string }) => c.id);
  if (campaignIds.length > 0) {
    const { data: links } = await supabase
      .from("tracking_links")
      .select("id")
      .in("campaign_id", campaignIds);
    const linkIds = (links ?? []).map((l: { id: string }) => l.id);
    if (linkIds.length > 0) {
      const { data: conversions } = await supabase
        .from("conversions")
        .select("order_amount, created_at")
        .in("tracking_link_id", linkIds)
        .gte("created_at", since)
        .not("status", "in", '("refunded","chargeback")');

      const daily = new Map<string, { revenueCents: number; conversions: number }>();
      for (const c of (conversions ?? []) as ConversionRow[]) {
        const amount = Number(c.order_amount) || 0;
        organic.revenueCents += Math.round(amount * 100);
        organic.conversions += 1;
        const date = c.created_at.slice(0, 10);
        const bucket = daily.get(date) ?? { revenueCents: 0, conversions: 0 };
        bucket.revenueCents += Math.round(amount * 100);
        bucket.conversions += 1;
        daily.set(date, bucket);
      }
      organic.daily = [...daily.entries()]
        .map(([date, v]) => ({ date, revenueCents: v.revenueCents, conversions: v.conversions }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }
  }

  const blendedRevenueCents = totals.revenueCents + organic.revenueCents;
  const blendedRoas =
    totals.spendCents > 0 ? blendedRevenueCents / totals.spendCents : null;

  return NextResponse.json({
    totals: {
      spendCents: totals.spendCents,
      revenueCents: totals.revenueCents,
      conversions: totals.conversions,
      roas,
      costPerConversionCents: costPerConversion,
    },
    organic: {
      revenueCents: organic.revenueCents,
      conversions: organic.conversions,
      daily: organic.daily,
    },
    blended: {
      revenueCents: blendedRevenueCents,
      roas: blendedRoas,
    },
    campaigns: records.map((r) => ({
      id: r.id,
      name: r.google_campaign_name ?? `${r.goal} campaign`,
      status: r.status,
      spendCents: Number(r.total_spend_cents) || 0,
      revenueCents: Number(r.revenue_cents) || 0,
      conversions: Number(r.conversions) || 0,
    })),
  });
}
