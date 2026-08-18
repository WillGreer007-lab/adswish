"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Loader2 } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    async function checkOnboarding() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?redirect=/onboarding");
        return;
      }

      const role = user.user_metadata?.role as string;

      if (role === "creator") {
        const { data: profile } = await supabase
          .from("creator_profiles")
          .select("onboarding_step")
          .eq("user_id", user.id)
          .single();

        const step = profile?.onboarding_step || "profile_setup";
        router.push(`/onboarding/creator/${step}`);
      } else if (role === "business") {
        const { data: profile } = await supabase
          .from("business_profiles")
          .select("onboarding_step")
          .eq("user_id", user.id)
          .single();

        const step = profile?.onboarding_step || "company_info";
        router.push(`/onboarding/business/${step}`);
      } else {
        router.push("/dashboard");
      }
    }

    checkOnboarding();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
