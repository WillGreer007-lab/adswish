import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SecuritySettings } from "@/components/dashboard/security-settings";

export const metadata = { title: "Security — Adswish" };

export default async function SecuritySettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard/settings/security");

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
          <h1 className="font-heading text-2xl font-bold">Security</h1>
          <p className="text-sm text-muted-foreground">
            Two-factor authentication (2FA) protects your account with a one-time
            code from an authenticator app.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <SecuritySettings />
        </div>
      </div>
    </DashboardShell>
  );
}
