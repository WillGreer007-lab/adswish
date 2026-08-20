import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SessionTimeoutSettings } from "@/components/dashboard/session-timeout-settings";

export const metadata = { title: "Session timeout — Adswish" };

export default async function SessionTimeoutPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard/settings/session");

  const { data: biz } = await supabase
    .from("business_profiles")
    .select("company_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: creator } = await supabase
    .from("creator_profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const isBusiness = !!biz;
  const role = isBusiness ? ("business" as const) : ("creator" as const);
  const name = biz?.company_name || creator?.display_name || "Account";

  return (
    <DashboardShell role={role} userId={user.id} userName={name}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Session timeout</h1>
          <p className="text-sm text-muted-foreground">
            Automatically log you out after a period of inactivity.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <SessionTimeoutSettings />
        </div>
      </div>
    </DashboardShell>
  );
}
