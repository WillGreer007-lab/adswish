import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell, EmptyState } from "@/components/dashboard/dashboard-shell";
import { formatCurrency } from "@/lib/utils";
import { AnalyticsCharts, type DailyPoint } from "@/components/dashboard/analytics-charts";
import { MousePointerClick, ShoppingCart, TrendingUp, CreditCard, BarChart3 } from "lucide-react";

const money = (n: number) => formatCurrency(n);

type RollupRow = {
  date: string;
  total_clicks: number | string | null;
  total_conversions: number | string | null;
  gross_sales: number | string | null;
  creator_cut: number | string | null;
  platform_cut: number | string | null;
};

function buildDaily(rows: RollupRow[]): DailyPoint[] {
  const byDate = new Map<string, DailyPoint>();
  for (const r of rows) {
    const key = (r.date ?? "").slice(0, 10);
    if (!key) continue;
    const cur = byDate.get(key) ?? { date: key, clicks: 0, conversions: 0, gross: 0 };
    cur.clicks += Number(r.total_clicks ?? 0);
    cur.conversions += Number(r.total_conversions ?? 0);
    cur.gross += Number(r.gross_sales ?? 0);
    byDate.set(key, cur);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export default async function BusinessAnalyticsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard");

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("company_name, onboarding_step, balance_cents")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.onboarding_step !== "complete") redirect("/onboarding");

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, title, type, status")
    .eq("business_id", user.id)
    .is("deleted_at", null);

  const ids = (campaigns ?? []).map((c) => c.id);

  const { data: rollups } = ids.length
    ? await supabase.from("daily_conversion_rollups").select("date, total_clicks, total_conversions, gross_sales, creator_cut, platform_cut").in("campaign_id", ids)
    : { data: [] };

  const daily = buildDaily((rollups ?? []) as RollupRow[]);

  const clicks = (rollups ?? []).reduce((s, r) => s + Number(r.total_clicks ?? 0), 0);
  const conversions = (rollups ?? []).reduce((s, r) => s + Number(r.total_conversions ?? 0), 0);
  const gross = (rollups ?? []).reduce((s, r) => s + Number(r.gross_sales ?? 0), 0);
  const creatorPaid = (rollups ?? []).reduce((s, r) => s + Number(r.creator_cut ?? 0), 0);
  const platformFees = (rollups ?? []).reduce((s, r) => s + Number(r.platform_cut ?? 0), 0);
  const convRate = clicks > 0 ? ((conversions / clicks) * 100).toFixed(1) : "0.0";

  const activeCount = (campaigns ?? []).filter((c) => c.status === "active").length;
  const { data: spend } = await supabase
    .from("balance_transactions")
    .select("amount_cents")
    .eq("business_id", user.id)
    .eq("type", "campaign_spend");
  const totalSpend = (spend ?? []).reduce((s, r) => s + Math.abs(Number(r.amount_cents ?? 0)), 0) / 100;

  return (
    <DashboardShell role="business" userId={user.id} userName={profile.company_name}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Campaign performance, attribution, and spend across your account.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-5">
            <MousePointerClick className="mb-2 h-4 w-4 text-primary" />
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total clicks</p>
            <p className="mt-1 font-mono text-2xl font-bold">{clicks.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <ShoppingCart className="mb-2 h-4 w-4 text-primary" />
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Conversions</p>
            <p className="mt-1 font-mono text-2xl font-bold">{conversions.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{convRate}% conversion rate</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <TrendingUp className="mb-2 h-4 w-4 text-success" />
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Gross sales</p>
            <p className="mt-1 font-mono text-2xl font-bold text-success">{money(gross)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <CreditCard className="mb-2 h-4 w-4 text-warning" />
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Fixed-campaign spend</p>
            <p className="mt-1 font-mono text-2xl font-bold text-warning">{money(totalSpend)}</p>
            <p className="text-xs text-muted-foreground">{money(creatorPaid)} paid to creators</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Platform fees collected</p>
          <p className="mt-2 font-mono text-2xl font-bold text-primary">{money(platformFees)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Active campaigns: {activeCount}</p>
        </div>

        <AnalyticsCharts daily={daily} />

        {(campaigns ?? []).length === 0 && (
          <EmptyState
            icon={BarChart3}
            title="No campaigns yet"
            description="Launch a campaign and start tracking clicks and conversions here."
            ctaLabel="New campaign"
            ctaHref="/dashboard/business/campaigns/new"
          />
        )}
      </div>
    </DashboardShell>
  );
}
