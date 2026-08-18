import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CampaignMessages } from "@/components/dashboard/campaign-messages";

export default async function CreatorMessagesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard");

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("display_name, onboarding_step")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.onboarding_step !== "complete") redirect("/onboarding");

  return (
    <DashboardShell role="creator" userId={user.id} userName={profile.display_name}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Conversations with businesses on your active campaigns.
          </p>
        </div>
        <CampaignMessages userId={user.id} />
      </div>
    </DashboardShell>
  );
}
