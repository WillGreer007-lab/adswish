"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { BarChart3, Loader2, Unplug } from "lucide-react";

type AnalyticsData = {
  totals: {
    spendCents: number;
    revenueCents: number;
    conversions: number;
    roas: number | null;
    costPerConversionCents: number | null;
  };
  organic: {
    revenueCents: number;
    conversions: number;
    daily: { date: string; revenueCents: number; conversions: number }[];
  };
  blended: {
    revenueCents: number;
    roas: number | null;
  };
  campaigns: {
    id: string;
    name: string;
    status: string;
    spendCents: number;
    revenueCents: number;
    conversions: number;
  }[];
};

const GBP = (cents: number) => `£${(cents / 100).toFixed(2)}`;

function readColors() {
  if (typeof document === "undefined") {
    return { primary: "#3a5ce0", success: "#10b981", warning: "#f59e0b", muted: "#565a68", border: "#e4e6ec" };
  }
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    primary: get("--primary", "#3a5ce0"),
    success: get("--success", "#10b981"),
    warning: get("--warning", "#f59e0b"),
    muted: get("--muted-foreground", "#565a68"),
    border: get("--border", "#e4e6ec"),
  };
}

const chartTooltipStyle = (colors: ReturnType<typeof readColors>) => ({
  backgroundColor: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
});

export function GoogleAdsAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/internal/google-ads/analytics");
      if (res.ok) {
        const json = (await res.json()) as AnalyticsData;
        setData(json);
      }
    } catch {
      /* leave the empty state */
    }
  }, []);

  useEffect(() => {
    // Defer: the effect body must not setState synchronously (React 19 rule).
    queueMicrotask(() => {
      load().finally(() => setLoaded(true));
    });
  }, [load]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-surface py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const campaigns = data?.campaigns ?? [];
  const organic = data?.organic ?? { revenueCents: 0, conversions: 0, daily: [] };
  const blended = data?.blended ?? { revenueCents: 0, roas: null };

  if (campaigns.length === 0 && organic.conversions === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="font-heading text-sm font-semibold">Blended ROAS</h3>
        </div>
        <div className="mt-4 flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background">
          <Unplug className="h-6 w-6 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            No organic conversions or Google Ads campaigns yet — analytics appear once you start tracking.
          </p>
        </div>
      </div>
    );
  }

  const totals = data!.totals;
  const colors = readColors();
  const pieColors = [colors.success, colors.primary, colors.warning, colors.muted, "#8b5cf6"];

  const spendRevenue = campaigns.map((c) => ({
    name: c.name.length > 18 ? `${c.name.slice(0, 18)}…` : c.name,
    Spend: c.spendCents / 100,
    Revenue: c.revenueCents / 100,
  }));
  const revenueByCampaign = campaigns
    .filter((c) => c.revenueCents > 0 || c.spendCents > 0)
    .map((c) => ({ name: c.name.length > 14 ? `${c.name.slice(0, 14)}…` : c.name, value: c.revenueCents / 100 }));

  const revenueBySource = [
    { name: "Organic", value: organic.revenueCents / 100 },
    { name: "Google Ads", value: totals.revenueCents / 100 },
  ].filter((s) => s.value > 0);

  const organicDaily = organic.daily.map((d) => ({
    date: d.date.slice(5),
    Revenue: d.revenueCents / 100,
  }));

  const statCards = [
    { label: "Paid spend", value: GBP(totals.spendCents), hint: "Across connected campaigns" },
    { label: "Paid revenue", value: GBP(totals.revenueCents), hint: "Attributed via Google Ads" },
    { label: "Organic revenue", value: GBP(organic.revenueCents), hint: "Attributed via your tracking links" },
    { label: "Blended revenue", value: GBP(blended.revenueCents), hint: "Organic + paid" },
    { label: "Blended ROAS", value: blended.roas !== null ? `${blended.roas.toFixed(2)}x` : "—", hint: "Total revenue ÷ paid spend" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="font-heading text-sm font-semibold">Blended ROAS</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Organic + paid performance, side by side. Paid figures appear once the Ads API reporting sync runs.
        </p>
      </div>

      {/* Totals */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-1.5 font-mono text-xl font-bold">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
          </div>
        ))}
      </div>

      {/* Revenue by source */}
      {revenueBySource.length > 1 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface p-5">
            <h4 className="mb-4 font-heading text-sm font-semibold">Revenue by source</h4>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={revenueBySource} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {revenueBySource.map((_, i) => (
                      <Cell key={i} fill={pieColors[i % pieColors.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip contentStyle={chartTooltipStyle(colors)} formatter={(v) => GBP(Number(v) * 100)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Organic 30-day series */}
          {organicDaily.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-5">
              <h4 className="mb-4 font-heading text-sm font-semibold">Organic revenue — last 30 days</h4>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={organicDaily} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.muted }} tickLine={false} axisLine={{ stroke: colors.border }} />
                    <YAxis tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} />
                    <ChartTooltip contentStyle={chartTooltipStyle(colors)} cursor={{ fill: "var(--primary-light)" }} />
                    <Bar dataKey="Revenue" fill={colors.success} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Spend vs revenue by campaign */}
      {campaigns.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-5">
          <h4 className="mb-4 font-heading text-sm font-semibold">Spend vs revenue by campaign</h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spendRevenue} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={{ stroke: colors.border }} />
                <YAxis tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} />
                <ChartTooltip contentStyle={chartTooltipStyle(colors)} cursor={{ fill: "var(--primary-light)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Spend" fill={colors.muted} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Revenue" fill={colors.success} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Revenue share by campaign */}
      {revenueByCampaign.length > 1 && (
        <div className="rounded-lg border border-border bg-surface p-5">
          <h4 className="mb-4 font-heading text-sm font-semibold">Paid revenue by campaign</h4>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={revenueByCampaign} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {revenueByCampaign.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <ChartTooltip contentStyle={chartTooltipStyle(colors)} formatter={(v) => GBP(Number(v) * 100)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Campaign table */}
      {campaigns.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-5">
          <h4 className="mb-3 font-heading text-sm font-semibold">Campaign breakdown</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Campaign</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Spend</th>
                  <th className="py-2 pr-4 font-medium">Revenue</th>
                  <th className="py-2 font-medium">Conversions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4 font-medium">{c.name}</td>
                    <td className="py-2.5 pr-4 capitalize text-muted-foreground">{c.status}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{GBP(c.spendCents)}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{GBP(c.revenueCents)}</td>
                    <td className="py-2.5">{c.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
