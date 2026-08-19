import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell, EmptyState, EarningsWidget } from "@/components/dashboard/dashboard-shell";
import { Megaphone, Search, TrendingUp, Sparkles } from "lucide-react";
import { tierColor, tierLabel } from "@/lib/tier";
import Link from "next/link";

export default async function CreatorDashboard() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.onboarding_step !== "complete") {
    redirect("/onboarding");
  }

  const { data: subscription } = await supabase
    .from("creator_subscriptions")
    .select("plan_slug")
    .eq("creator_id", user.id)
    .single();

  const planBadge = subscription?.plan_slug
    ? subscription.plan_slug.replace("creator_", "").charAt(0).toUpperCase() +
      subscription.plan_slug.replace("creator_", "").slice(1)
    : "Free";


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

        {subscription?.plan_slug === "creator_free" && (
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                Upgrade to Pro for instant payouts and priority placement.
              </p>
            </div>
            <Link
              href="/dashboard/creator/profile?upgrade=pro"
              className="text-sm font-medium text-primary hover:underline"
            >
              Upgrade
            </Link>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Earnings</span>
          <div className="flex rounded-md border border-border">
            <button className="rounded-l-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Today</button>
            <button className="border-l border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted">7 days</button>
            <button className="rounded-r-md border-l border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted">30 days</button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <EarningsWidget type="fixed" pending={0} available={0} />
          <EarningsWidget type="affiliate" pending={0} available={0} />
          <EarningsWidget type="hybrid" pending={0} available={0} />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Active campaigns</h2>
            <Link href="/dashboard/creator/discover" className="text-sm font-medium text-primary hover:underline">
              Browse all
            </Link>
          </div>
          <EmptyState
            icon={Megaphone}
            title="No active campaigns yet"
            description="Browse the Discover page to find campaigns to apply to."
            ctaLabel="Discover campaigns"
            ctaHref="/dashboard/creator/discover"
          />
        </div>
      </div>
    </DashboardShell>
  );
}
