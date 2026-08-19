import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BusinessGrid } from "@/components/marketing/business-grid";
import { Button } from "@/components/ui/button";
import {
  Megaphone,
  TrendingUp,
  MessageSquare,
  ShieldAlert,
  CreditCard,
  BarChart3,
  Radar,
  CheckCircle2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Discover businesses — Adswish",
  description:
    "Browse businesses running creator campaigns on Adswish. See verified domains, ratings, and campaign history.",
};

const businessFeatures = [
  { icon: Megaphone, title: "Campaign engine", desc: "Launch fixed, affiliate, and hybrid campaigns with budget caps and deadline controls." },
  { icon: Radar, title: "Tracking & attribution", desc: "Pixel script or Chrome extension with edge-redirected links and first-party cookies." },
  { icon: MessageSquare, title: "Applicant chat", desc: "Review applicants and message creators in real time with PII filtering." },
  { icon: ShieldAlert, title: "SLA guard", desc: "72-hour dispute resolution and three-strike accountability for missed deadlines." },
  { icon: CreditCard, title: "Escrow payouts", desc: "Funds held in escrow, released automatically after a 7-day window." },
  { icon: BarChart3, title: "Analytics", desc: "Today / 7-day / 30-day dashboards with conversion and attribution depth." },
  { icon: TrendingUp, title: "Creator directory", desc: "Filter creators by tier, niche, rating, and verified follower counts." },
  { icon: CheckCircle2, title: "Verified domains", desc: "Green checkmarks on businesses with a live, verified tracking domain." },
];

export default async function BusinessesPage() {
  const supabase = await createSupabaseServerClient();

  const { data: businesses } = await supabase
    .from("business_profiles")
    .select("user_id, company_name, logo_url, bio, verified_domain, average_rating")
    .is("deleted_at", null)
    .order("average_rating", { ascending: false })
    .limit(100);

  const ids = (businesses ?? []).map((b) => b.user_id);
  const { data: subs } = ids.length
    ? await supabase
        .from("business_subscriptions")
        .select("business_id, plan_slug")
        .in("business_id", ids)
        .eq("status", "active")
    : { data: [] };

  const planByBusiness = new Map((subs ?? []).map((s) => [s.business_id, s.plan_slug]));
  const rows = (businesses ?? []).map((b) => ({
    ...b,
    plan_slug: planByBusiness.get(b.user_id) ?? "business_free",
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Business Marketplace</p>
        <h1 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">Discover businesses</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Browse businesses running campaigns on Adswish — see verified domains, ratings, and what
          the business side can do for your next collaboration.
        </p>
      </div>

      {/* Business-side features */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {businessFeatures.map((f) => (
          <div key={f.title} className="rounded-lg border border-border bg-surface p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <f.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-heading text-sm font-semibold">{f.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>

      <BusinessGrid businesses={rows} />

      <div className="mt-12 flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 p-8 text-center">
        <h2 className="font-heading text-xl font-bold">Ready to launch campaigns?</h2>
        <p className="max-w-lg text-sm text-muted-foreground">
          Join as a business to post campaigns, review applicants, and track every conversion.
        </p>
        <Button asChild>
          <Link href="/signup?role=business">Launch a campaign</Link>
        </Button>
      </div>
    </div>
  );
}
