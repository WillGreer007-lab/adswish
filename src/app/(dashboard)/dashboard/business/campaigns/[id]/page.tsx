import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CampaignDetail } from "@/components/dashboard/campaign-detail";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (!campaign) redirect("/dashboard/business");

  const { data: rawApplications } = await supabase
    .from("applications")
    .select(`
      id, creator_id, status, applied_at, cover_note, tier_at_application,
      creator_profiles!inner(user_id, display_name, profile_picture_url, tier, average_rating, niches)
    `)
    .eq("campaign_id", id)
    .order("applied_at", { ascending: false });

  // to-one embedded relations are typed as arrays by supabase-js but return a
  // single object at runtime — normalize before passing to the client component.
  const applications = (rawApplications || []).map((a: any) => ({
    ...a,
    creator_profiles: Array.isArray(a.creator_profiles) ? a.creator_profiles[0] : a.creator_profiles,
  }));

  const { data: deliverables } = await supabase
    .from("deliverables")
    .select("*")
    .eq("campaign_id", id)
    .order("creator_id, slot_number", { ascending: true });

  const { data: businessProfile } = await supabase
    .from("business_profiles")
    .select("company_name")
    .eq("user_id", user.id)
    .single();

  const isOwner = campaign.business_id === user.id;

  if (!isOwner) redirect("/dashboard");

  return (
    <DashboardShell role="business" userId={user.id} userName={businessProfile?.company_name || "Business"}>
      <CampaignDetail
        campaign={campaign}
        applications={applications}
        deliverables={deliverables || []}
      />
    </DashboardShell>
  );
}
