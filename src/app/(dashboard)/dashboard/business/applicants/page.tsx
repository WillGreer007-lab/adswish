import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell, EmptyState } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowRight } from "lucide-react";

export default async function BusinessApplicantsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard");

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("company_name, onboarding_step")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.onboarding_step !== "complete") redirect("/onboarding");

  const { data: ownCampaignIds } = await supabase
    .from("campaigns")
    .select("id")
    .eq("business_id", user.id);

  const ids = (ownCampaignIds || []).map((c) => c.id);

  if (ids.length === 0) {
    return (
      <DashboardShell role="business" userId={user.id} userName={profile.company_name}>
        <div className="space-y-6">
          <div>
            <h1 className="font-heading text-2xl font-bold">Applicants</h1>
            <p className="text-sm text-muted-foreground">Review creator applications.</p>
          </div>
          <EmptyState
            icon={Users}
            title="No applicants yet"
            description="Once you launch a campaign, creators will appear here for review."
          />
        </div>
      </DashboardShell>
    );
  }

  const { data: apps } = await supabase
    .from("applications")
    .select(`
      id, status, applied_at, cover_note, tier_at_application,
      campaign_id,
      campaigns!inner(title),
      creator_profiles!inner(display_name, profile_picture_url, average_rating)
    `)
    .in("campaign_id", ids)
    .order("applied_at", { ascending: false })
    .limit(100);

  // to-one embedded relations are typed as arrays by supabase-js — normalize.
  const pending = (apps || [])
    .filter((a) => a.status === "pending")
    .map((a: any) => ({
      ...a,
      campaigns: Array.isArray(a.campaigns) ? a.campaigns[0] : a.campaigns,
      creator_profiles: Array.isArray(a.creator_profiles) ? a.creator_profiles[0] : a.creator_profiles,
    }));

  return (
    <DashboardShell role="business" userId={user.id} userName={profile.company_name}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Applicants</h1>
          <p className="text-sm text-muted-foreground">
            {pending.length} pending application{pending.length === 1 ? "" : "s"} across your campaigns.
          </p>
        </div>

        {pending.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No pending applicants"
            description="New applications will appear here."
          />
        ) : (
          <div className="space-y-3">
            {pending.map((app) => (
              <Link
                key={app.id}
                href={`/dashboard/business/campaigns/${app.campaign_id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface p-4 transition-shadow hover:shadow-md"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{app.creator_profiles?.display_name}</p>
                    <Badge variant="secondary">{app.tier_at_application}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {app.campaigns?.title} · ★ {app.creator_profiles?.average_rating ?? 0}
                  </p>
                  {app.cover_note && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{app.cover_note}</p>
                  )}
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-1 text-sm text-primary">
                  Review <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
