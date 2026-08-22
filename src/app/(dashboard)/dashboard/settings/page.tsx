import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Bell, Radar, CreditCard, Download, ArrowRight, Clock, ShieldCheck } from "lucide-react";
import { AppearanceSettings } from "@/components/dashboard/appearance-settings";
import { VerificationMethods } from "@/components/dashboard/verification-methods";

export const metadata = { title: "Settings — Adswish" };

const cards = [
  {
    href: "/dashboard/settings/notifications",
    icon: Bell,
    title: "Notifications",
    desc: "Choose which alerts you get and how (in-app, email, push).",
  },
  {
    href: "/dashboard/business/tracking",
    icon: Radar,
    title: "Tracking & Attribution",
    desc: "Pixel script or the Adswish Chrome extension — pick how your conversions get attributed.",
    badge: "Extension + script",
  },
  {
    href: "/dashboard/creator/payouts",
    icon: CreditCard,
    title: "Payouts",
    desc: "Connect Stripe for payouts and view your payout status.",
  },
  {
    href: "/api/internal/data-export",
    icon: Download,
    title: "Download my data",
    desc: "Export your profile, campaigns, messages, reviews, and financial history as JSON.",
    download: true,
  },
  {
    href: "/dashboard/settings/session",
    icon: Clock,
    title: "Session timeout",
    desc: "Auto-logout after inactivity — 1, 5, 10, or 30 minutes.",
  },
  {
    href: "/dashboard/settings/security",
    icon: ShieldCheck,
    title: "Security & 2FA",
    desc: "Two-factor authentication with Google or Microsoft Authenticator.",
  },
];

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard/settings");

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

  const { data: socials } = await supabase
    .from("creator_social_accounts")
    .select("id, platform, handle, follower_count, verified_at")
    .eq("creator_id", user.id);

  // Role-gated cards: businesses get Tracking; creators get Payouts.
  const visible = isBusiness
    ? cards
    : cards.filter((c) => c.href !== "/dashboard/business/tracking");

  return (
    <DashboardShell role={role} userId={user.id} userName={name}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage notifications, tracking, and payouts.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 font-heading text-base font-semibold">Appearance</h2>
          <AppearanceSettings />
        </div>

        {!isBusiness && (
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-4 font-heading text-base font-semibold">Connected accounts</h2>
            <VerificationMethods initial={(socials ?? []) as never} />
            {(socials ?? []).some((s) => s.verified_at) && (
              <a
                href={`/audit/${user.id}`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <ShieldCheck className="h-4 w-4" />
                View public verification report
              </a>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((card) => {
            const content = (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <card.icon className="h-5 w-5 text-primary" />
                  </div>
                  {card.badge && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {card.badge}
                    </span>
                  )}
                </div>
                <h2 className="mt-4 font-heading text-base font-semibold">{card.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{card.desc}</p>
                <span className="mt-3 inline-flex items-center text-sm font-medium text-primary">
                  {card.download ? "Download" : "Open"} <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </>
            );
            const className = "group rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary/50";
            return card.download ? (
              <a key={card.href} href={card.href} download className={className}>{content}</a>
            ) : (
              <Link key={card.href} href={card.href} className={className}>{content}</Link>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
