import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardRedirect() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  const role = user.user_metadata?.role as string;

  if (role === "creator") {
    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("onboarding_step")
      .eq("user_id", user.id)
      .single();

    if (profile && profile.onboarding_step !== "complete") {
      redirect(`/onboarding/creator/${profile.onboarding_step}`);
    }

    redirect("/dashboard/creator");
  }

  if (role === "business") {
    const { data: profile } = await supabase
      .from("business_profiles")
      .select("onboarding_step")
      .eq("user_id", user.id)
      .single();

    if (profile && profile.onboarding_step !== "complete") {
      redirect(`/onboarding/business/${profile.onboarding_step}`);
    }

    redirect("/dashboard/business");
  }

  if (role === "admin") {
    redirect("/admin");
  }

  redirect("/login");
}
