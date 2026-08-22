"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Search,
  Megaphone,
  Users,
  DollarSign,
  MessageSquare,
  Settings,
  CreditCard,
  Radar,
  User,
  BarChart3,
  Crown,
  Puzzle,
  Target,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string };

const GOOGLE_ADS_HREF = "/dashboard/business/google-ads";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard/creator": LayoutDashboard,
  "/dashboard/creator/discover": Search,
  "/dashboard/creator/campaigns": Megaphone,
  "/dashboard/creator/earnings": DollarSign,
  "/dashboard/creator/analytics": BarChart3,
  "/dashboard/creator/payouts": CreditCard,
  "/dashboard/creator/messages": MessageSquare,
  "/dashboard/creator/plan": Crown,
  "/dashboard/creator/profile": User,
  "/dashboard/creator/integrations": Puzzle,
  "/dashboard/business": LayoutDashboard,
  "/dashboard/business/campaigns": Megaphone,
  "/dashboard/business/campaigns/verification": ShieldCheck,
  "/dashboard/business/applicants": Users,
  "/dashboard/business/payments": DollarSign,
  "/dashboard/business/analytics": BarChart3,
  "/dashboard/business/google-ads": Target,
  "/dashboard/business/tracking": Radar,
  "/dashboard/business/messages": MessageSquare,
  "/dashboard/business/plan": Crown,
  "/dashboard/business/profile": User,
  "/dashboard/business/integrations": Puzzle,
  "/dashboard/settings": Settings,
};

/**
 * Renders the sidebar nav links. For business users, the Google Ads entry is
 * only shown once the integration has been "added" from the Integrations hub;
 * removing it hides the link again (so the dashboard "goes away").
 *
 * This is a client component because the shell itself is rendered inside a
 * client boundary (e.g. creator/discover), so the integration state must be
 * fetched on the client instead of via the server-only Supabase client.
 */
export function SidebarNav({
  items,
  role,
}: {
  items: NavItem[];
  role: "creator" | "business";
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (role !== "business") return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/internal/integrations", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { added: { key: string }[] };
        if (cancelled) return;
        const added = data.added.some((r) => r.key === "google_ads");
        setHidden(added ? new Set() : new Set([GOOGLE_ADS_HREF]));
      } catch {
        /* offline — leave the nav unchanged */
      }
    };
    load();
    const onUpdated = () => load();
    window.addEventListener("adswish:integrations-updated", onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("adswish:integrations-updated", onUpdated);
    };
  }, [role]);

  const visible = items.filter((item) => !hidden.has(item.href));

  return (
    <nav className="flex-1 space-y-1 px-2 py-2">
      {visible.map((item) => {
        const Icon = ICONS[item.href] ?? LayoutDashboard;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
