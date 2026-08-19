import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdswishLogo } from "@/components/shared/logo";

export const metadata: Metadata = {
  title: "Plans & pricing — Adswish",
  description:
    "Compare Adswish plans for businesses and creators. Transparent limits that grow with you, on a 10% platform fee model.",
};

type Plan = {
  slug: string;
  name: string;
  price: string;
  period: string;
  blurb: string;
  popular?: boolean;
  features: string[];
};

const BUSINESS_PLANS: Plan[] = [
  {
    slug: "business_free",
    name: "Free",
    price: "£0",
    period: "/mo",
    blurb: "Test the marketplace with your first fixed-fee campaigns.",
    features: [
      "3 active campaigns",
      "Fixed-fee campaigns only",
      "Basic pixel + extension tracking",
      "Manual applicant review",
      "7-day payout holds",
      "Standard support",
    ],
  },
  {
    slug: "business_growth",
    name: "Growth",
    price: "£7",
    period: "/mo",
    blurb: "Run more campaigns with affiliate and hybrid payouts.",
    popular: true,
    features: [
      "20 active campaigns",
      "Affiliate + hybrid campaigns",
      "Advanced tracking analytics",
      "Bulk approval tools",
      "2 team seats",
      "Priority support",
    ],
  },
  {
    slug: "business_enterprise",
    name: "Enterprise",
    price: "£15",
    period: "/mo",
    blurb: "Scale with unlimited campaigns and a service-level guarantee.",
    features: [
      "Unlimited campaigns",
      "Everything in Growth",
      "5 team seats",
      "4-hour SLA response",
      "Dedicated onboarding",
      "Custom reporting",
    ],
  },
];

const CREATOR_PLANS: Plan[] = [
  {
    slug: "creator_free",
    name: "Free",
    price: "£0",
    period: "/mo",
    blurb: "Get discovered and apply to your first campaigns.",
    features: [
      "Up to 2 active campaigns",
      "Small-creator tier: fixed campaigns",
      "5 saved filter presets",
      "Basic profile + socials",
      "7-day payout hold",
      "Standard support",
    ],
  },
  {
    slug: "creator_pro",
    name: "Pro",
    price: "£5",
    period: "/mo",
    blurb: "Stand out and get paid faster.",
    popular: true,
    features: [
      "Up to 10 active campaigns",
      "Priority applicant badge",
      "Unlimited saved filters",
      "Advanced earnings analytics",
      "Instant payout (skip 7-day hold)",
      "Priority support",
    ],
  },
  {
    slug: "creator_premium",
    name: "Premium",
    price: "£10",
    period: "/mo",
    blurb: "The full toolkit for established creators.",
    features: [
      "Unlimited active campaigns",
      "\u201cVerified Pro\u201d badge",
      "Campaign performance insights",
      "Everything in Pro",
      "Dedicated support channel",
      "Early access to new features",
    ],
  },
];

function PlanCard({ plan, ctaHref, ctaLabel }: { plan: Plan; ctaHref: string; ctaLabel: string }) {
  return (
    <div className={`relative flex flex-col rounded-xl border-2 p-6 ${plan.popular ? "border-primary" : "border-border"}`}>
      {plan.popular && (
        <span className="absolute -top-3 right-4 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
          Most popular
        </span>
      )}
      <h3 className="font-heading text-xl font-bold">{plan.name}</h3>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-3xl font-bold">{plan.price}</span>
        <span className="text-sm text-muted-foreground">{plan.period}</span>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{plan.blurb}</p>
      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
            <span className="text-muted-foreground">{f}</span>
          </li>
        ))}
      </ul>
      <Button asChild className="mt-6 w-full">
        <Link href={ctaHref}>{ctaLabel}</Link>
      </Button>
    </div>
  );
}

export default function PlansPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <AdswishLogo wordmark={false} className="h-8 w-8 text-primary" />
            <span className="font-heading text-xl font-bold tracking-tight">adswish</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/signup">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <Badge variant="outline" className="mb-3">Plans &amp; pricing</Badge>
          <h1 className="font-heading text-4xl font-bold sm:text-5xl">
            Limits that grow with you.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            One flat 10% platform fee on every campaign — no hidden cuts. Upgrade to unlock
            more campaigns, faster payouts, and deeper analytics.
          </p>
        </div>

        {/* Business plans */}
        <div className="mt-16">
          <div className="mb-6 flex items-center gap-3">
            <h2 className="font-heading text-2xl font-bold">For businesses</h2>
            <span className="text-sm text-muted-foreground">Launch &amp; track creator campaigns</span>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {BUSINESS_PLANS.map((p) => (
              <PlanCard key={p.slug} plan={p} ctaHref={`/signup?role=business`} ctaLabel={p.slug === "business_free" ? "Start free" : "Get started"} />
            ))}
          </div>
        </div>

        {/* Creator plans */}
        <div className="mt-16">
          <div className="mb-6 flex items-center gap-3">
            <h2 className="font-heading text-2xl font-bold">For creators</h2>
            <span className="text-sm text-muted-foreground">Get discovered &amp; get paid</span>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {CREATOR_PLANS.map((p) => (
              <PlanCard key={p.slug} plan={p} ctaHref={`/signup?role=creator`} ctaLabel={p.slug === "creator_free" ? "Start free" : "Get started"} />
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 p-8 text-center">
          <h3 className="font-heading text-xl font-bold">Creators keep 90% on every plan</h3>
          <p className="max-w-xl text-sm text-muted-foreground">
            The plan price is separate from campaign payouts. On every order, 90% goes to the
            creator and 10% stays with Adswish as the platform fee — the number you see is the
            number you get.
          </p>
          <Link href="/signup" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Create a free account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
