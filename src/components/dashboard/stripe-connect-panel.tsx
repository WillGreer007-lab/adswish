"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

const POLL_INTERVAL_MS = 20000;

/**
 * Reusable Stripe Connect panel used both in onboarding (step 4) and in the
 * dashboard Payouts settings page. Reads status straight from Stripe and
 * self-heals via polling, so a missed webhook never leaves the UI stale.
 */
export function StripeConnectPanel({
  title = "Set up payouts with Stripe",
  subtitle = "Required before you can apply to campaigns.",
  onSkip,
  skipLabel = "Skip for now (you can't apply to campaigns yet)",
}: {
  title?: string;
  subtitle?: string;
  onSkip?: () => Promise<void>;
  skipLabel?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setChecking(true);
    setRefreshMessage(null);
    try {
      const response = await fetch("/api/internal/stripe/connect-status", { method: "POST" });
      const data = await response.json();
      if (data.ready) {
        setStripeReady(true);
      } else if (data.reason === "account_lookup_failed") {
        setRefreshMessage("Stripe hasn't finished processing yet — checking again shortly.");
      } else if (data.reason === "no_account") {
        setRefreshMessage("No payout account yet — click “Connect with Stripe” to create one.");
      } else {
        setRefreshMessage("Onboarding isn't complete yet. Finish all Stripe steps, then check again.");
      }
    } catch {
      setRefreshMessage("Could not reach Stripe. Please try again.");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?redirect=/dashboard/creator/payouts");
        return;
      }
      const { data: profile } = await supabase
        .from("creator_profiles")
        .select("stripe_connect_ready")
        .eq("user_id", user.id)
        .single();
      setStripeReady(profile?.stripe_connect_ready || false);
      if (!profile?.stripe_connect_ready) {
        await refreshStatus();
      }
    }
    loadData();
  }, [router, refreshStatus]);

  useEffect(() => {
    if (stripeReady) return;
    const id = setInterval(() => {
      void refreshStatus();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [stripeReady, refreshStatus]);

  async function handleConnectStripe() {
    setLoading(true);
    try {
      const response = await fetch("/api/internal/stripe/connect-link", { method: "POST" });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {stripeReady ? (
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="mb-4 h-12 w-12 text-success" />
            <p className="font-heading text-lg font-semibold">Stripe Connect is ready!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your payouts are set up. Creators keep 90%.
            </p>
            <Button onClick={() => router.push("/dashboard")} className="mt-6">
              Go to dashboard
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
                <div>
                  <p className="text-sm font-medium">Payout setup required</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Complete Stripe Connect Express onboarding (including tax forms)
                    to receive payouts.
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={handleConnectStripe} className="w-full" disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Connecting...</>
              ) : (
                "Connect with Stripe"
              )}
            </Button>

            <Button
              onClick={refreshStatus}
              variant="outline"
              className="w-full"
              disabled={checking}
            >
              {checking ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Checking…</>
              ) : (
                "I finished onboarding — check now"
              )}
            </Button>

            {refreshMessage && (
              <p className="text-xs text-muted-foreground">{refreshMessage}</p>
            )}

            {onSkip && (
              <Button onClick={onSkip} variant="ghost" className="w-full">
                {skipLabel}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
