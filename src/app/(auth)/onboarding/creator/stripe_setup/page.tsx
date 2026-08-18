"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { StripeConnectPanel } from "@/components/dashboard/stripe-connect-panel";

export default function CreatorStripeSetup() {
  const router = useRouter();

  async function handleSkip() {
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("creator_profiles")
        .update({ onboarding_step: "complete" })
        .eq("user_id", user.id);
    }
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <StripeConnectPanel
        subtitle="Step 4 of 4 — Required before you can apply to campaigns."
        onSkip={handleSkip}
      />
    </div>
  );
}
