import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Check, Crown, CalendarClock, Gauge, Layers } from "lucide-react";
import { PlanUpgradeButton } from "@/components/dashboard/plan-upgrade-button";
import { TIER_LIMITS, TIER_META } from "@/lib/tier";
import { CREATOR_PLAN_CAMPAIGN_LIMITS } from "@/lib/campaign-limits";

type PlanMeta = {
  name: string;
  price: string;
  cents: number;
  maxCampaigns: number | null; // null = unlimited
  limitLabel: string;
  features: string[];
};

const PLANS: Record<string, PlanMeta> = {
  business_free: {
    name: "Free",
    price: "£0",
    cents: 0,
    maxCampaigns: 3,
    limitLabel: "campaigns / month",
    features: ["3 active campaigns / month", "Fixed-fee campaigns", "Basic pixel + extension tracking", "7-day payout holds"],
  },
  business_growth: {
    name: "Growth",
    price: "£7/mo",
    cents: 700,
    maxCampaigns: 20,
    limitLabel: "campaigns / month",
    features: ["20 active campaigns / month", "Affiliate + hybrid campaigns", "Advanced tracking analytics", "2 team seats", "Priority support"],
  },
  business_enterprise: {
    name: "Enterprise",
    price: "£15/mo",
    cents: 1500,
    maxCampaigns: null,
    limitLabel: "campaigns / month",
    features: ["Unlimited campaigns", "Everything in Growth", "5 team seats", "4-hour SLA response", "Custom reporting"],
  },
  creator_free: {
    name: "Free",
    price: "£0",
    cents: 0,
    maxCampaigns: 2,
    limitLabel: "active campaigns",
    features: ["Up to 2 active campaigns", "5 saved filter presets", "7-day payout hold", "Basic profile + socials"],
  },
  creator_pro: {
    name: "Pro",
    price: "£5/mo",
    cents: 500,
    maxCampaigns: 10,
    limitLabel: "active campaigns",
    features: ["Up to 10 active campaigns", "Priority applicant badge", "Unlimited saved filters", "Instant payout (skip hold)"],
  },
  creator_premium: {
    name: "Premium",
    price: "£10/mo",
    cents: 1000,
    maxCampaigns: null,
    limitLabel: "active campaigns",
    features: ["Unlimited active campaigns", '"Verified Pro" badge', "Campaign performance insights", "Dedicated support"],
  },
};

const UPGRADES: Record<"business" | "creator", string[]> = {
  business: ["business_free", "business_growth", "business_enterprise"],
  creator: ["creator_free", "creator_pro", "creator_premium"],
};

function statusBadge(status: string | null) {
  const map: Record<string, string> = {
    active: "bg-success/10 text-success",
    trialing: "bg-blue-500/10 text-blue-700",
    past_due: "bg-destructive/10 text-destructive",
    canceled: "bg-muted text-muted-foreground",
  };
  return map[status ?? "active"] ?? map.active;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export async function PlanDashboard({ role, userId }: { role: "business" | "creator"; userId: string }) {
  const supabase = await createSupabaseServerClient();

  const subTable = role === "business" ? "business_subscriptions" : "creator_subscriptions";
  const idCol = role === "business" ? "business_id" : "creator_id";
  const defaultSlug = role === "business" ? "business_free" : "creator_free";

  const { data: sub } = await supabase
    .from(subTable)
    .select("plan_slug, status, current_period_end, stripe_subscription_id")
    .eq(idCol, userId)
    .single();

  const planSlug = sub?.plan_slug ?? defaultSlug;
  const plan = PLANS[planSlug] ?? PLANS[defaultSlug];

  // Usage counter.
  let used = 0;
  let creatorTier: "micro" | "mid" | "macro" | null = null;
  if (role === "business") {
    const { data: profile } = await supabase
      .from("business_profiles")
      .select("campaigns_created_this_month, campaigns_created_month")
      .eq("user_id", userId)
      .single();
    const thisMonth = new Date().toISOString().slice(0, 7);
    used = profile?.campaigns_created_month === thisMonth ? (profile.campaigns_created_this_month ?? 0) : 0;
  } else {
    const [profileRes, acceptedRes] = await Promise.all([
      supabase.from("creator_profiles").select("tier").eq("user_id", userId).single(),
      supabase
        .from("applications")
        .select("campaign_id")
        .eq("creator_id", userId)
        .eq("status", "accepted"),
    ]);
    creatorTier = (profileRes.data?.tier as "micro" | "mid" | "macro") ?? null;
    const acceptedCampaignIds = [...new Set((acceptedRes.data ?? []).map((row) => row.campaign_id))];
    if (acceptedCampaignIds.length) {
      const { data: activeCampaigns } = await supabase
        .from("campaigns")
        .select("id")
        .in("id", acceptedCampaignIds)
        .in("status", ["active", "paused"]);
      used = activeCampaigns?.length ?? 0;
    }
  }

  // Creator limits: the effective cap is min(plan cap, tier cap).
  const planCap = plan.maxCampaigns === null ? Infinity : plan.maxCampaigns;
  const tierCap = creatorTier ? TIER_LIMITS[creatorTier].maxActiveCampaigns : null;
  const effectiveCap = role === "creator" && tierCap !== null ? Math.min(planCap, tierCap) : planCap;

  const upgrades = UPGRADES[role];

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          <h2 className="font-heading text-lg font-semibold">Current plan</h2>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
          <span className="font-heading text-3xl font-bold">{plan.name}</span>
          <span className="font-mono text-xl text-muted-foreground">{plan.price}</span>
          <span className={`mb-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(sub?.status ?? "active")}`}>
            {sub?.status ?? "active"}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Next payment</p>
              <p className="text-sm font-medium">
                {plan.cents === 0 ? "Free — no payment" : formatDate(sub?.current_period_end ?? null)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Usage</p>
              <p className="text-sm font-medium">
                {used} / {Number.isFinite(effectiveCap) ? effectiveCap : "Unlimited"} {plan.limitLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Usage progress */}
        {Number.isFinite(effectiveCap) && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (used / effectiveCap) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {effectiveCap - used > 0
                ? `${effectiveCap - used} ${plan.limitLabel} left this period`
                : `You've reached your ${plan.limitLabel} limit — upgrade to run more`}
            </p>
          </div>
        )}

        <ul className="mt-5 space-y-2">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
              <span className="text-muted-foreground">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Creator limits: tier cap + plan cap together */}
      {role === "creator" && creatorTier && (
        <div className="rounded-lg border border-border bg-surface p-6">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-lg font-semibold">Your active-campaign limits</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            You can run at most the <strong>lower</strong> of your tier cap and your plan cap.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Tier</p>
              <p className="mt-1 text-sm font-medium">
                {TIER_META[creatorTier].label}
              </p>
              <p className="mt-1 font-mono text-lg font-bold">
                {tierCap === Infinity ? "Unlimited" : `${tierCap} cap`}
              </p>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan</p>
              <p className="mt-1 text-sm font-medium">{plan.name}</p>
              <p className="mt-1 font-mono text-lg font-bold">
                {planCap === Infinity ? "Unlimited" : `${planCap} cap`}
              </p>
            </div>
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Effective</p>
              <p className="mt-1 text-sm font-medium">Applied cap</p>
              <p className="mt-1 font-mono text-lg font-bold text-primary">
                {Number.isFinite(effectiveCap) ? effectiveCap : "Unlimited"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upgrades */}
      <div>
        <h2 className="mb-3 font-heading text-lg font-semibold">Change plan</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {upgrades.map((slug) => {
            const meta = PLANS[slug];
            const isCurrent = slug === planSlug;
            return (
              <div key={slug} className={`flex flex-col rounded-lg border p-5 ${isCurrent ? "border-primary bg-primary/5" : "border-border bg-surface"}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base font-semibold">{meta.name}</h3>
                  {isCurrent && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Current</span>}
                </div>
                <p className="mt-1 font-mono text-lg font-bold">{meta.price}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {meta.maxCampaigns === null ? `Unlimited ${meta.limitLabel}` : `${meta.maxCampaigns} ${meta.limitLabel}`}
                </p>
                <ul className="mt-3 flex-1 space-y-1.5">
                  {meta.features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <PlanUpgradeButton planSlug={slug} label={isCurrent ? "Current" : slug === defaultSlug ? "Downgrade" : `Upgrade to ${meta.name}`} current={isCurrent} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Plan payments are separate from campaign payouts — creators still keep 90% of every order on any plan.
        </p>
      </div>
    </div>
  );
}
