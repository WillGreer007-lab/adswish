import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell, EmptyState } from "@/components/dashboard/dashboard-shell";
import { CreatorCampaignList } from "@/components/dashboard/creator-campaigns";
import { Megaphone } from "lucide-react";

export default async function CreatorCampaignsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard");

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("display_name, onboarding_step")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.onboarding_step !== "complete") redirect("/onboarding");

  const { data: rawAccepted } = await supabase
    .from("applications")
    .select(`
      id, campaign_id,
      campaigns!inner(id, title, type, business_id, status)
    `)
    .eq("creator_id", user.id)
    .eq("status", "accepted");

  // to-one embedded relation typed as array by supabase-js — normalize.
  const accepted = (rawAccepted || []).map((a: any) => ({
    ...a,
    campaigns: Array.isArray(a.campaigns) ? a.campaigns[0] : a.campaigns,
  }));

  const campaignIds = (accepted || []).map((a) => a.campaign_id);

  const { data: deliverables } =
    campaignIds.length > 0
      ? await supabase
          .from("deliverables")
          .select("*")
          .eq("creator_id", user.id)
          .in("campaign_id", campaignIds)
          .order("slot_number", { ascending: true })
      : { data: [] };

  return (
    <DashboardShell role="creator" userId={user.id} userName={profile.display_name}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">My Campaigns</h1>
          <p className="text-sm text-muted-foreground">Submit deliverables and track your lock-and-key progress.</p>
        </div>

        {!accepted || accepted.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No active campaigns"
            description="Browse the Discover page to find campaigns to apply to."
            ctaLabel="Discover campaigns"
            ctaHref="/dashboard/creator/discover"
          />
        ) : (
          <CreatorCampaignList applications={accepted} deliverables={deliverables || []} />
        )}
      </div>
    </DashboardShell>
  );
}
