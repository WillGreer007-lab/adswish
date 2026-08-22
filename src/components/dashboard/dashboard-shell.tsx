import Link from "next/link";
import {
  LayoutDashboard,
  Search,
  Megaphone,
  Users,
  DollarSign,
  MessageSquare,
  Settings,
  CheckCircle2,
  CreditCard,
  Radar,
  User,
  BarChart3,
  Crown,
  Puzzle,
  Target,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "@/components/dashboard/notification-center";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { BackButton } from "@/components/dashboard/back-button";
import { SessionTimeoutGuard } from "@/components/dashboard/session-timeout-guard";
import { BackButtonLogout } from "@/components/dashboard/back-button-logout";
import { PaymentsPausedBanner } from "@/components/dashboard/payments-paused-banner";

const CREATOR_NAV = [
  { label: "Overview", href: "/dashboard/creator", icon: LayoutDashboard },
  { label: "Discover", href: "/dashboard/creator/discover", icon: Search },
  { label: "My Campaigns", href: "/dashboard/creator/campaigns", icon: Megaphone },
  { label: "Earnings", href: "/dashboard/creator/earnings", icon: DollarSign },
  { label: "Analytics", href: "/dashboard/creator/analytics", icon: BarChart3 },
  { label: "Payouts", href: "/dashboard/creator/payouts", icon: CreditCard },
  { label: "Messages", href: "/dashboard/creator/messages", icon: MessageSquare },
  { label: "Plan", href: "/dashboard/creator/plan", icon: Crown },
  { label: "Profile", href: "/dashboard/creator/profile", icon: User },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Integrations", href: "/dashboard/creator/integrations", icon: Puzzle },
];

const BUSINESS_NAV = [
  { label: "Overview", href: "/dashboard/business", icon: LayoutDashboard },
  { label: "Campaigns", href: "/dashboard/business/campaigns", icon: Megaphone },
  { label: "Verification", href: "/dashboard/business/campaigns/verification", icon: ShieldCheck },
  { label: "Applicants", href: "/dashboard/business/applicants", icon: Users },
  { label: "Payments", href: "/dashboard/business/payments", icon: DollarSign },
  { label: "Analytics", href: "/dashboard/business/analytics", icon: BarChart3 },
  { label: "Google Ads", href: "/dashboard/business/google-ads", icon: Target },
  { label: "Tracking", href: "/dashboard/business/tracking", icon: Radar },
  { label: "Messages", href: "/dashboard/business/messages", icon: MessageSquare },
  { label: "Plan", href: "/dashboard/business/plan", icon: Crown },
  { label: "Profile", href: "/dashboard/business/profile", icon: User },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Integrations", href: "/dashboard/business/integrations", icon: Puzzle },
];

export function DashboardShell({
  role,
  userId,
  userName,
  planBadge,
  children,
}: {
  role: "creator" | "business";
  userId: string;
  userName: string;
  planBadge?: string;
  children: React.ReactNode;
}) {
  const nav = role === "creator" ? CREATOR_NAV : BUSINESS_NAV;
  const roleLabel = role === "business" ? "Business" : "Creator";

  return (
    <div className="flex min-h-screen">
      <SessionTimeoutGuard />
      <BackButtonLogout />

      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-shrink-0 border-r border-border bg-surface md:flex md:flex-col">
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <span className="font-heading text-lg font-bold">adswish</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="mt-0.5 text-sm font-medium">{userName}</p>
          <p className="mt-1 mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <CheckCircle2 className="h-3 w-3" />
            {planBadge ?? "Free"} · {roleLabel}
          </p>
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-heading text-base font-bold">adswish</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <BackButton fallbackHref={role === "creator" ? "/dashboard/creator" : "/dashboard/business"} />
            <NotificationCenter userId={userId} />
            <LogoutButton variant="topbar" />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-8">
          <div className="dashboard-content mx-auto max-w-6xl">
            <PaymentsPausedBanner role={role} userId={userId} />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface p-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

export function EarningsWidget({
  type,
  pending,
  available,
}: {
  type: "fixed" | "affiliate" | "hybrid";
  pending: number;
  available: number;
}) {
  const colors = {
    fixed: "text-payment-fixed",
    affiliate: "text-payment-affiliate",
    hybrid: "text-payment-hybrid",
  };
  const labels = {
    fixed: "Fixed earnings",
    affiliate: "Affiliate earnings",
    hybrid: "Hybrid earnings",
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{labels[type]}</p>
      <p className={cn("mt-2 font-mono text-2xl font-bold", colors[type])}>
        ${(available + pending).toFixed(2)}
      </p>
      <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
        <span>Pending: ${pending.toFixed(2)}</span>
        <span>Available: ${available.toFixed(2)}</span>
      </div>
    </div>
  );
}
