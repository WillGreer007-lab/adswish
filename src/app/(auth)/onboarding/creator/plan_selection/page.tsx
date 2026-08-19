"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    slug: "creator_free",
    name: "Free",
    price: "$0",
    period: "/mo",
    features: [
      "Apply to campaigns",
      "Basic profile",
      "Standard support",
      "5 saved filter presets",
      "7-day hold on payouts",
    ],
  },
  {
    slug: "creator_pro",
    name: "Pro",
    price: "$5",
    period: "/mo",
    features: [
      "Everything in Free",
      "Priority applicant badge",
      "Unlimited saved filters",
      "Advanced earnings analytics",
      "Instant payout (skip 7-day hold)",
    ],
    popular: true,
  },
  {
    slug: "creator_premium",
    name: "Premium",
    price: "$10",
    period: "/mo",
    features: [
      "Everything in Pro",
      '"Verified Pro" badge',
      "Campaign performance insights",
      "Dedicated support channel",
    ],
  },
];

export default function CreatorPlanSelection() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState("creator_free");

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

  async function handleContinue() {
    if (!userId) return;
    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    await supabase.from("creator_subscriptions").upsert({
      creator_id: userId,
      plan_slug: selected,
      status: selected === "creator_free" ? "active" : "trialing",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "creator_id" });

    await supabase
      .from("creator_profiles")
      .update({ onboarding_step: "stripe_setup" })
      .eq("user_id", userId);

    // Paid plans open the Stripe hosted checkout before continuing.
    if (selected !== "creator_free") {
      const res = await fetch("/api/internal/stripe/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_slug: selected }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.url) {
        window.location.href = json.url;
        return;
      }
    }

    router.push("/onboarding/creator/stripe_setup");
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Choose your plan</CardTitle>
        <p className="text-sm text-muted-foreground">
          Step 3 of 4 — Start free, upgrade anytime. 10% commission on all plans.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <button
              key={plan.slug}
              type="button"
              onClick={() => setSelected(plan.slug)}
              className={cn(
                "relative rounded-lg border-2 p-4 text-left transition-colors",
                selected === plan.slug
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              {plan.popular && (
                <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  Popular
                </span>
              )}
              <h3 className="font-heading text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1">
                <span className="font-mono text-2xl font-bold">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </p>
              <ul className="mt-3 space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs">
                    <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-success" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <Button onClick={handleContinue} className="mt-6 w-full" disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Continue"}
        </Button>
      </CardContent>
    </Card>
  );
}
