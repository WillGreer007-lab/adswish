import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StripeConnectPanel } from "@/components/dashboard/stripe-connect-panel";

export const dynamic = "force-dynamic";

export default async function CreatorPayoutsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/creator/payouts");

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .single();

  return (
    <DashboardShell
      role="creator"
      userId={user.id}
      userName={profile?.display_name || user.email || "Creator"}
    >
      <div className="max-w-md">
        <StripeConnectPanel
          title="Payouts"
          subtitle="Connect your Stripe account to receive your 90% earnings."
        />
      </div>
    </DashboardShell>
  );
}
