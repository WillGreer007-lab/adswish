import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { GoogleAdsDashboard } from "@/components/dashboard/google-ads/dashboard";

export const metadata = { title: "Google Ads — Adswish" };

export default async function BusinessGoogleAdsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard/business/google-ads");

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("company_name, onboarding_step")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.onboarding_step !== "complete") redirect("/onboarding");

  // The Google Ads dashboard is only reachable once the business has added
  // the integration from the Integrations hub.
  const { data: added } = await supabase
    .from("user_integrations")
    .select("integration_key")
    .eq("user_id", user.id)
    .eq("integration_key", "google_ads")
    .maybeSingle();
  if (!added) redirect("/dashboard/business/integrations");

  const { data: sub } = await supabase
    .from("business_subscriptions")
    .select("plan_slug")
    .eq("business_id", user.id)
    .single();

  const planSlug = sub?.plan_slug ?? "business_free";
  const planName = planSlug.replace("business_", "").replace(/_/g, " ").replace(/^\w/, (c: string) => c.toUpperCase());

  return (
    <DashboardShell role="business" userId={user.id} userName={profile.company_name} planBadge={planName}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Google Ads</h1>
          <p className="text-sm text-muted-foreground">
            Amplify approved creator content and blend paid + organic results in one dashboard.
          </p>
        </div>
        <GoogleAdsDashboard />
      </div>
    </DashboardShell>
  );
}
