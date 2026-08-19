"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type Range = "today" | "7d" | "30d";

const RANGES: { value: Range; label: string; days: number }[] = [
  { value: "today", label: "Today", days: 1 },
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
];

function withinRange(point: DailyPoint, range: Range): boolean {
  if (range === "30d") return true;
  const days = range === "today" ? 1 : 7;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  cutoff.setHours(0, 0, 0, 0);
  const d = new Date(`${point.date}T00:00:00`);
  return d >= cutoff;
}

export type DailyPoint = {
  date: string;
  clicks: number;
  conversions: number;
  gross: number;
};

function readColors() {
  if (typeof document === "undefined") {
    return { primary: "#3a5ce0", success: "#10b981", warning: "#f59e0b", muted: "#565a68", border: "#e4e6ec" };
  }
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => {
    const v = cs.getPropertyValue(name).trim();
    return v || fallback;
  };
  return {
    primary: get("--primary", "#3a5ce0"),
    success: get("--success", "#10b981"),
    warning: get("--warning", "#f59e0b"),
    muted: get("--muted-foreground", "#565a68"),
    border: get("--border", "#e4e6ec"),
  };
}

/** Re-read CSS variables whenever theme/accent changes, so charts follow dark mode + accents. */
function useCssColors() {
  const [colors, setColors] = useState(readColors);
  useEffect(() => {
    function refresh() {
      setColors(readColors());
    }
    refresh();
    const obs = new MutationObserver(refresh);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-accent"],
    });
    return () => obs.disconnect();
  }, []);
  return colors;
}

const tooltipStyle = (colors: ReturnType<typeof readColors>) => ({
  backgroundColor: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
});

export function AnalyticsCharts({ daily }: { daily: DailyPoint[] }) {
  const colors = useCssColors();
  const [range, setRange] = useState<Range>("30d");

  if (daily.length === 0) return null;

  const filtered = daily.filter((p) => withinRange(p, range));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Performance over time</h2>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                range === r.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">
          No activity in this window yet.
        </p>
      )}

      {/* Clicks vs conversions */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="mb-4 font-heading text-sm font-semibold">Clicks &amp; conversions by day</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filtered} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={{ stroke: colors.border }} />
              <YAxis tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle(colors)} cursor={{ fill: "var(--primary-light)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="clicks" name="Clicks" fill={colors.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="conversions" name="Conversions" fill={colors.success} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gross sales */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="mb-4 font-heading text-sm font-semibold">Gross sales by day</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filtered} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="grossFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.primary} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={{ stroke: colors.border }} />
              <YAxis tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle(colors)} />
              <Area type="monotone" dataKey="gross" name="Gross sales" stroke={colors.primary} fill="url(#grossFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
