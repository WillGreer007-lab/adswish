import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell, EmptyState } from "@/components/dashboard/dashboard-shell";
import { Megaphone, Users, DollarSign, Sparkles } from "lucide-react";
import Link from "next/link";

export default async function BusinessDashboard() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.onboarding_step !== "complete") {
    redirect("/onboarding");
  }

  const { data: subscription } = await supabase
    .from("business_subscriptions")
    .select("plan_slug")
    .eq("business_id", user.id)
    .single();

  const planBadge = subscription?.plan_slug
    ? subscription.plan_slug.replace("business_", "").charAt(0).toUpperCase() +
      subscription.plan_slug.replace("business_", "").slice(1)
    : "Free";

  const isFree = subscription?.plan_slug === "business_free" || !subscription;
  const campaignsUsed = profile.campaigns_created_this_month || 0;
  const campaignsMax = isFree ? 3 : Infinity;

  return (
    <DashboardShell role="business" userId={user.id} userName={profile.company_name} planBadge={planBadge}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Overview</h1>
            <p className="text-sm text-muted-foreground">Welcome back, {profile.company_name}.</p>
          </div>
          {profile.verified_domain && (
            <span className="flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
              ✓ Verified domain
            </span>
          )}
        </div>

        {isFree && (
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                {campaignsUsed} of {campaignsMax} campaigns used this month. Upgrade for unlimited campaigns.
              </p>
            </div>
            <Link
              href="/dashboard/business/profile?upgrade=growth"
              className="text-sm font-medium text-primary hover:underline"
            >
              Upgrade
            </Link>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Active campaigns</p>
            <p className="mt-2 font-mono text-2xl font-bold">0</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending applicants</p>
            <p className="mt-2 font-mono text-2xl font-bold">0</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total spent</p>
            <p className="mt-2 font-mono text-2xl font-bold">$0.00</p>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Campaigns</h2>
            <Link
              href="/dashboard/business/campaigns/new"
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
            >
              + New Campaign
            </Link>
          </div>
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Create your first campaign to start finding creators."
            ctaLabel="Create campaign"
            ctaHref="/dashboard/business/campaigns/new"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="mb-3 font-heading text-lg font-semibold">Applicants</h2>
            <EmptyState
              icon={Users}
              title="No applicants yet"
              description="Once you launch a campaign, creators will appear here for review."
            />
          </div>
          <div>
            <h2 className="mb-3 font-heading text-lg font-semibold">Payouts</h2>
            <EmptyState
              icon={DollarSign}
              title="No payouts yet"
              description="Escrow and payout history will appear here."
            />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
