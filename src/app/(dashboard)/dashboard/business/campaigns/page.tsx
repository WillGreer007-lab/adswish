import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell, EmptyState } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";

const statusVariant: Record<string, "success" | "secondary" | "destructive" | "warning" | "default"> = {
  active: "success",
  paused: "warning",
  paused_budget: "warning",
  completed: "secondary",
  cancelled: "destructive",
  draft: "default",
};

export default async function BusinessCampaignsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard");

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("company_name, onboarding_step")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.onboarding_step !== "complete") redirect("/onboarding");

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*, applications(count)")
    .eq("business_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const campaignIds = (campaigns || []).map((c) => c.id);
  const pendingApproval: Record<string, number> = {};
  if (campaignIds.length > 0) {
    const { data: pending } = await supabase
      .from("deliverables")
      .select("campaign_id")
      .in("campaign_id", campaignIds)
      .eq("status", "pending_business_review");
    for (const d of pending || []) {
      pendingApproval[d.campaign_id] = (pendingApproval[d.campaign_id] || 0) + 1;
    }
  }

  return (
    <DashboardShell role="business" userId={user.id} userName={profile.company_name}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Campaigns</h1>
            <p className="text-sm text-muted-foreground">Manage your campaigns and creators.</p>
          </div>
          <Link
            href="/dashboard/business/campaigns/new"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
          >
            + New Campaign
          </Link>
        </div>

        {!campaigns || campaigns.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Create your first campaign to start finding creators."
            ctaLabel="Create campaign"
            ctaHref="/dashboard/business/campaigns/new"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {campaigns.map((campaign) => {
              const applicantCount = campaign.applications?.[0]?.count ?? 0;
              const pendingCount = pendingApproval[campaign.id] || 0;
              return (
                <Link
                  key={campaign.id}
                  href={`/dashboard/business/campaigns/${campaign.id}`}
                  className="rounded-lg border border-border bg-surface p-5 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-heading text-base font-semibold">{campaign.title}</h3>
                    <Badge variant={statusVariant[campaign.status] ?? "secondary"}>
                      {campaign.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">{campaign.type}</p>
                  <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                    <span>{applicantCount} applicant{applicantCount === 1 ? "" : "s"}</span>
                    <span className={pendingCount > 0 ? "text-primary" : ""}>
                      {pendingCount} pending approval
                    </span>
                    {campaign.budget_cap != null && (
                      <span>
                        ${campaign.total_spent.toFixed(0)} / ${campaign.budget_cap.toFixed(0)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
