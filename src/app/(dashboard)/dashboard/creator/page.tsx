import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell, EmptyState, EarningsWidget } from "@/components/dashboard/dashboard-shell";
import { Megaphone, Search, Sparkles, CheckCircle2, Clock3 } from "lucide-react";
import { tierColor, tierLabel } from "@/lib/tier";
import { getAppCurrency } from "@/lib/utils";

type AcceptedCampaign = {
  id: string;
  title: string;
  type: "fixed" | "affiliate" | "hybrid";
  status: string;
};

type AcceptedApplication = {
  id: string;
  campaign_id: string;
  campaigns: AcceptedCampaign | AcceptedCampaign[] | null;
};

type Deliverable = {
  id: string;
  campaign_id: string;
  status: string;
};

type LedgerRow = {
  type: string;
  amount: number | string | null;
  related_conversion_id: string | null;
};

type ConversionRow = {
  id: string;
  status: string;
  tracking_link_id: string;
};

type TrackingLinkRow = {
  id: string;
  campaign_id: string;
};

type CampaignTypeRow = {
  id: string;
  type: "fixed" | "affiliate" | "hybrid";
};

const TERMINAL_DELIVERABLES = new Set([
  "completed",
  "kicked",
  "dropped_by_business",
  "auto_dropped_sla",
]);

const PAYMENT_TYPES = ["fixed", "affiliate", "hybrid"] as const;
type PaymentType = (typeof PAYMENT_TYPES)[number];

type Earnings = { pending: number; available: number };

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function CreatorDashboard() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("display_name, onboarding_step, tier")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.onboarding_step !== "complete") {
    redirect("/onboarding");
  }

  const [subscriptionRes, applicationsRes, ledgerRes] = await Promise.all([
    supabase
      .from("creator_subscriptions")
      .select("plan_slug")
      .eq("creator_id", user.id)
      .single(),
    supabase
      .from("applications")
      .select("id, campaign_id, campaigns!inner(id, title, type, status)")
      .eq("creator_id", user.id)
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("ledger_entries")
      .select("type, amount, related_conversion_id")
      .not("related_conversion_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const accepted = ((applicationsRes.data ?? []) as AcceptedApplication[]).map((row) => ({
    ...row,
    campaigns: relation(row.campaigns),
  })).filter((row): row is AcceptedApplication & { campaigns: AcceptedCampaign } => Boolean(row.campaigns));
  const acceptedCampaignIds = [...new Set(accepted.map((row) => row.campaign_id))];

  const { data: deliverables } = acceptedCampaignIds.length
    ? await supabase
        .from("deliverables")
        .select("id, campaign_id, status")
        .eq("creator_id", user.id)
        .in("campaign_id", acceptedCampaignIds)
    : { data: [] as Deliverable[] };

  // Resolve ledger entries through the creator's own tracking links so the
  // overview can show real pending/available earnings per payment type without
  // trusting client-provided campaign labels.
  const ledger = (ledgerRes.data ?? []) as LedgerRow[];
  const conversionIds = [...new Set(ledger.map((row) => row.related_conversion_id).filter(Boolean) as string[])];
  const { data: conversions } = conversionIds.length
    ? await supabase
        .from("conversions")
        .select("id, status, tracking_link_id")
        .in("id", conversionIds)
    : { data: [] as ConversionRow[] };
  const linkIds = [...new Set(((conversions ?? []) as ConversionRow[]).map((row) => row.tracking_link_id))];
  const { data: links } = linkIds.length
    ? await supabase
        .from("tracking_links")
        .select("id, campaign_id")
        .in("id", linkIds)
    : { data: [] as TrackingLinkRow[] };
  const campaignIds = [...new Set(((links ?? []) as TrackingLinkRow[]).map((row) => row.campaign_id))];
  const { data: campaignTypes } = campaignIds.length
    ? await supabase
        .from("campaigns")
        .select("id, type")
        .in("id", campaignIds)
    : { data: [] as CampaignTypeRow[] };

  const conversionById = new Map((conversions ?? []).map((row) => [row.id, row as ConversionRow]));
  const linkById = new Map((links ?? []).map((row) => [row.id, row as TrackingLinkRow]));
  const typeByCampaign = new Map((campaignTypes ?? []).map((row) => [row.id, row.type as PaymentType]));
  const earnings: Record<PaymentType, Earnings> = {
    fixed: { pending: 0, available: 0 },
    affiliate: { pending: 0, available: 0 },
    hybrid: { pending: 0, available: 0 },
  };

  for (const row of ledger) {
    const conversion = row.related_conversion_id ? conversionById.get(row.related_conversion_id) : null;
    const link = conversion ? linkById.get(conversion.tracking_link_id) : null;
    const type = link ? typeByCampaign.get(link.campaign_id) : undefined;
    if (!conversion || !type) continue;

    const amount = Number(row.amount ?? 0);
    if (row.type === "hold" && conversion.status === "pending_hold") {
      earnings[type].pending += amount;
    } else if (row.type === "release" && conversion.status === "released") {
      earnings[type].available += amount;
    }
  }

  const planSlug = subscriptionRes.data?.plan_slug ?? "creator_free";
  const planBadge = planSlug.replace("creator_", "").charAt(0).toUpperCase() +
    planSlug.replace("creator_", "").slice(1);
  const activeApplications = accepted.filter((row) =>
    row.campaigns.status === "active" || row.campaigns.status === "paused",
  );

  return (
    <DashboardShell role="creator" userId={user.id} userName={profile.display_name} planBadge={planBadge}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Overview</h1>
            <p className="text-sm text-muted-foreground">Welcome back, {profile.display_name}.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${tierColor(profile.tier)}`}>
            {tierLabel(profile.tier)}
          </span>
        </div>

        {planSlug === "creator_free" && (
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                Upgrade to Pro for instant payouts and priority placement.
              </p>
            </div>
            <Link href="/dashboard/creator/plan" className="text-sm font-medium text-primary hover:underline">
              Upgrade
            </Link>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Earnings</span>
          <Link href="/dashboard/creator/analytics" className="text-sm font-medium text-primary hover:underline">
            View analytics →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <EarningsWidget type="fixed" pending={earnings.fixed.pending} available={earnings.fixed.available} />
          <EarningsWidget type="affiliate" pending={earnings.affiliate.pending} available={earnings.affiliate.available} />
          <EarningsWidget type="hybrid" pending={earnings.hybrid.pending} available={earnings.hybrid.available} />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Active campaigns</h2>
            <Link href="/dashboard/creator/campaigns" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>

          {activeApplications.length === 0 ? (
            <EmptyState
              icon={activeApplications.length === 0 && accepted.length > 0 ? CheckCircle2 : Megaphone}
              title={accepted.length > 0 ? "No active campaigns" : "No active campaigns yet"}
              description={accepted.length > 0 ? "Your accepted campaigns are complete or paused." : "Browse the Discover page to find campaigns to apply to."}
              ctaLabel="Discover campaigns"
              ctaHref="/dashboard/creator/discover"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeApplications.map((application) => {
                const items = (deliverables ?? []).filter((row) => row.campaign_id === application.campaign_id);
                const completed = items.filter((row) => TERMINAL_DELIVERABLES.has(row.status)).length;
                return (
                  <Link
                    key={application.id}
                    href="/dashboard/creator/campaigns"
                    className="rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-heading font-semibold">{application.campaigns.title}</p>
                        <p className="mt-1 text-xs capitalize text-muted-foreground">{application.campaigns.type} · {application.campaigns.status}</p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {completed}/{items.length}
                      </span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-success transition-all"
                        style={{ width: `${items.length ? Math.round((completed / items.length) * 100) : 0}%` }}
                      />
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      {items.length ? <Clock3 className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
                      {items.length ? `${completed} of ${items.length} deliverables complete` : "Deliverables are being prepared"}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          Earnings are calculated from the verified ledger. Pending funds stay on hold until the 7-day release window completes; available funds are released through your connected payout account.
          <span className="ml-1 font-medium text-foreground">All amounts are shown in {getAppCurrency()}.</span>
        </div>
      </div>
    </DashboardShell>
  );
}
