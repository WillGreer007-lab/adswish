"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function BusinessStripeSetup() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?redirect=/onboarding");
        return;
      }
      setUserId(user.id);
    }
    loadData();
  }, [router]);

  async function handleSetupPayment() {
    if (!userId) return;
    setLoading(true);

    try {
      const response = await fetch("/api/internal/stripe/setup-payment", { method: "POST" });
      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Failed to create setup link");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  async function handleSkip() {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from("business_profiles")
      .update({ onboarding_step: "complete" })
      .eq("user_id", userId);
    router.push("/dashboard");
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Set up your payment method</CardTitle>
        <p className="text-sm text-muted-foreground">
          Step 4 of 4 — Required before launching campaigns.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
              <div>
                <p className="text-sm font-medium">Payment method required</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add a payment method to fund campaigns. You won&apos;t be charged until
                  you approve a creator or a conversion is tracked. The 10% platform fee
                  includes all Stripe processing costs.
                </p>
              </div>
            </div>
          </div>

          <Button onClick={handleSetupPayment} className="w-full" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Connecting...</>
            ) : (
              "Add payment method"
            )}
          </Button>

          <Button onClick={handleSkip} variant="outline" className="w-full">
            Skip for now (you can&apos;t launch campaigns yet)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
