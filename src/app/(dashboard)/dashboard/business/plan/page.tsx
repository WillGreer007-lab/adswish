import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PlanDashboard } from "@/components/dashboard/plan-dashboard";

export const metadata = { title: "Plan — Adswish" };

export default async function BusinessPlanPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard/business/plan");

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("company_name, onboarding_step")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.onboarding_step !== "complete") redirect("/onboarding");

  return (
    <DashboardShell role="business" userId={user.id} userName={profile.company_name}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Plan</h1>
          <p className="text-sm text-muted-foreground">Your subscription, limits, and next payment.</p>
        </div>
        <PlanDashboard role="business" userId={user.id} />
      </div>
    </DashboardShell>
  );
}
