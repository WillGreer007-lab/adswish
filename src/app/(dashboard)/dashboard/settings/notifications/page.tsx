import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { NotificationPreferencesForm } from "@/components/dashboard/notification-preferences-form";

export const metadata = { title: "Notification Settings" };

export default async function NotificationSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/settings/notifications");

  const role =
    user.app_metadata?.role === "business"
      ? ("business" as const)
      : ("creator" as const);

  let userName = "You";
  if (role === "business") {
    const { data } = await supabase
      .from("business_profiles").select("company_name").eq("user_id", user.id).single();
    userName = data?.company_name ?? "You";
  } else {
    const { data } = await supabase
      .from("creator_profiles").select("display_name").eq("user_id", user.id).single();
    userName = data?.display_name ?? "You";
  }

  return (
    <DashboardShell role={role} userId={user.id} userName={userName}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Notification Settings</h1>
          <p className="text-sm text-muted-foreground">
            Mute specific notification types or disable email/push delivery.
          </p>
        </div>
        <NotificationPreferencesForm />
      </div>
    </DashboardShell>
  );
}
