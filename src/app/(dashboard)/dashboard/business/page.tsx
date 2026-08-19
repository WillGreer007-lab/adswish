import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell, EmptyState } from "@/components/dashboard/dashboard-shell";
import { Megaphone, Users, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

type CampaignRow = { id: string; title: string; type: string; status: string; created_at: string };
type ApplicantRow = {
  id: string;
  status: string;
  created_at: string;
  campaigns: { title: string } | { title: string }[] | null;
  creator_profiles: { display_name: string; profile_picture_url: string | null } | { display_name: string; profile_picture_url: string | null }[] | null;
};

const typeColor: Record<string, string> = {
  fixed: "text-payment-fixed",
  affiliate: "text-payment-affiliate",
  hybrid: "text-payment-hybrid",
};

export default async function BusinessDashboard() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard");

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.onboarding_step !== "complete") redirect("/onboarding");

  const { data: subscription } = await supabase
    .from("business_subscriptions")
    .select("plan_slug")
    .eq("business_id", user.id)
    .single();

  const planSlug = subscription?.plan_slug ?? "business_free";
  const planBadge = planSlug.replace("business_", "").replace(/_/g, " ").replace(/^\w/, (c: string) => c.toUpperCase());
  const isFree = planSlug === "business_free";
  const campaignsUsed = profile.campaigns_created_this_month || 0;
  const campaignsMax = isFree ? 3 : planSlug === "business_growth" ? 20 : Infinity;

  const [campaignsRes, applicantsRes, activeCountRes] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, title, type, status, created_at")
      .eq("business_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("applications")
      .select("id, status, created_at, campaigns(title), creator_profiles(display_name, profile_picture_url)")
      .eq("campaigns.business_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("business_id", user.id)
      .in("status", ["active", "paused"])
      .is("deleted_at", null),
  ]);

  const campaigns = (campaignsRes.data ?? []) as CampaignRow[];
  const applicants = (applicantsRes.data ?? []) as ApplicantRow[];
  const activeCount = activeCountRes.count ?? 0;
  const pendingCount = applicants.filter((a) => a.status === "pending").length;
  const balanceCents = Number(profile.balance_cents ?? 0);

  const first = (v: { title?: string; display_name?: string; profile_picture_url?: string | null } | { title?: string; display_name?: string; profile_picture_url?: string | null }[] | null, key: "title" | "display_name" | "profile_picture_url") =>
    Array.isArray(v) ? v[0]?.[key] : v?.[key];

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
                {campaignsUsed} of {campaignsMax} campaigns used this month.
              </p>
            </div>
            <Link href="/plans" className="text-sm font-medium text-primary hover:underline">
              View plans
            </Link>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Active campaigns</p>
            <p className="mt-2 font-mono text-2xl font-bold">{activeCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending applicants</p>
            <p className="mt-2 font-mono text-2xl font-bold">{pendingCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Wallet balance</p>
            <p className="mt-2 font-mono text-2xl font-bold">£{(balanceCents / 100).toFixed(2)}</p>
            <Link href="/dashboard/business/payments" className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
              Top up →
            </Link>
          </div>
        </div>

        {/* Campaigns */}
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

          {campaigns.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No campaigns yet"
              description="Create your first campaign to start finding creators."
              ctaLabel="Create campaign"
              ctaHref="/dashboard/business/campaigns/new"
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="divide-y divide-border">
                {campaigns.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/business/campaigns/${c.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize ${typeColor[c.type] ?? ""}`}>
                      {c.type}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs capitalize text-muted-foreground">
                      {c.status.replace(/_/g, " ")}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent applicants */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Recent applicants</h2>
            <Link href="/dashboard/business/applicants" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>

          {applicants.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No applicants yet"
              description="Once you launch a campaign, creators will appear here for review."
              ctaLabel="Browse creators"
              ctaHref="/creators"
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="divide-y divide-border">
                {applicants.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {first(a.creator_profiles, "profile_picture_url") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={first(a.creator_profiles, "profile_picture_url") as string} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (first(a.creator_profiles, "display_name") as string)?.charAt(0)?.toUpperCase() || "?"
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{first(a.creator_profiles, "display_name") || "Creator"}</p>
                      <p className="truncate text-xs text-muted-foreground">{first(a.campaigns, "title") || "Campaign"}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs capitalize ${
                      a.status === "pending" ? "bg-warning/10 text-warning" : a.status === "accepted" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                    }`}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
