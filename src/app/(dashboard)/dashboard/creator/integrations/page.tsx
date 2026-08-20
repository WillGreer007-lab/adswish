import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { IntegrationHub } from "@/components/dashboard/integration-hub";

export const metadata = { title: "Integrations — Adswish" };

export default async function CreatorIntegrationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard/creator/integrations");

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("display_name, onboarding_step")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.onboarding_step !== "complete") redirect("/onboarding");

  const { data: sub } = await supabase
    .from("creator_subscriptions")
    .select("plan_slug")
    .eq("creator_id", user.id)
    .single();

  const planSlug = sub?.plan_slug ?? "creator_free";
  const planName = planSlug.replace("creator_", "").replace(/_/g, " ").replace(/^\w/, (c: string) => c.toUpperCase());

  return (
    <DashboardShell role="creator" userId={user.id} userName={profile.display_name} planBadge={planName}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Connect your favourite tools to amplify your reach. Your plan determines how many you can add.
          </p>
        </div>
        <IntegrationHub planSlug={planSlug} planName={planName} />
      </div>
    </DashboardShell>
  );
}
