"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, ShieldCheck, Activity, Unplug, Loader2, AlertTriangle, CheckCircle2, Info, Pause, Play, Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/ui/google-icon";
import { GoogleAdsWizard } from "@/components/dashboard/google-ads/wizard";
import { GoogleAdsAnalytics } from "@/components/dashboard/google-ads/analytics";
import { GoogleAdsAbAssets } from "@/components/dashboard/google-ads/ab-assets";
import { GoogleAdsPartnerCredits } from "@/components/dashboard/google-ads/partner-credits";

const DEFAULT_KILL = { maxDaily: "50", maxTotal: "500", minConversions: "0", minRoas: "1.0" };

type KillSwitch = { maxDaily: string; maxTotal: string; minConversions: string; minRoas: string };
type CampaignRecord = {
  id: string;
  google_campaign_id: string | null;
  google_campaign_name: string | null;
  goal: string;
  target_location: string | null;
  daily_budget_cents: number | null;
  status: string;
  total_spend_cents: number | null;
  conversions: number | null;
  created_at: string;
};
type ActivityRow = { id: string; kind: string; message: string; created_at: string };

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-mono text-xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  active: "Active",
  paused: "Paused",
  removed: "Removed",
  tracking_injected: "Tracking injected",
};

export function GoogleAdsDashboard() {
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [banner, setBanner] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [kill, setKill] = useState<KillSwitch>(DEFAULT_KILL);
  const [saved, setSaved] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      setBanner({ kind: "success", text: "Google Ads connected — your account is now linked." });
    } else {
      const errorParam = params.get("error");
      if (errorParam) {
        setBanner({
          kind: "error",
          text:
            errorParam === "google_ads_not_configured"
              ? "Google Ads is not configured yet. Add the OAuth credentials in Vercel, then try again."
              : `Google sign-in failed: ${errorParam}`,
        });
      }
    }

    try {
      const res = await fetch("/api/internal/google-ads/status");
      if (res.ok) {
        const data = await res.json();
        setConnected(Boolean(data.connected));
        setConfigured(Boolean(data.configured));
        const ks = data.killSwitch ?? {};
        setKill({
          maxDaily: String(ks.maxDaily ?? DEFAULT_KILL.maxDaily),
          maxTotal: String(ks.maxTotal ?? DEFAULT_KILL.maxTotal),
          minConversions: String(ks.minConversions ?? DEFAULT_KILL.minConversions),
          minRoas: String(ks.minRoas ?? DEFAULT_KILL.minRoas),
        });
      }
    } catch {
      /* ignore */
    }

    try {
      const res = await fetch("/api/internal/google-ads/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns ?? []);
      }
    } catch {
      /* ignore */
    }

    try {
      const res = await fetch("/api/internal/google-ads/activity");
      if (res.ok) {
        const data = await res.json();
        setActivity(data.activity ?? []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Defer into a microtask: the effect body must not call setState
    // synchronously (React 19 lint rule), and load() starts with one.
    queueMicrotask(() => {
      load().finally(() => {
        if (!cancelled) setHydrated(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function handleDisconnect() {
    await fetch("/api/internal/google-ads/disconnect", { method: "POST" });
    setConnected(false);
    setBanner({ kind: "success", text: "Google Ads disconnected." });
    setCampaigns([]);
    setActivity([]);
  }

  async function saveKill() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    try {
      await fetch("/api/internal/google-ads/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxDaily: Number(kill.maxDaily) || undefined,
          maxTotal: Number(kill.maxTotal) || undefined,
          minConversions: Number(kill.minConversions) || undefined,
          minRoas: Number(kill.minRoas) || undefined,
        }),
      });
    } catch {
      /* persisted client-side state still applies on next load */
    }
  }

  async function campaignAction(id: string, action: "pause" | "resume" | "inject") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/internal/google-ads/campaigns/${id}/${action}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ kind: "error", text: data.error || "Action failed." });
        return;
      }
      if (data.note) setBanner({ kind: "info", text: data.note });
      await load();
    } catch {
      setBanner({ kind: "error", text: "Network error." });
    } finally {
      setBusyId(null);
    }
  }

  const stats = [
    { label: "Total spend", value: "£0.00", hint: connected ? "Awaiting Ads API reporting" : "Connect to start" },
    { label: "Clicks", value: "0", hint: connected ? "No clicks recorded" : "Connect to start" },
    { label: "Conversions", value: "0", hint: connected ? "No conversions recorded" : "Connect to start" },
    { label: "ROAS", value: "—", hint: "Awaiting data" },
    { label: "Cost / conv.", value: "—", hint: "Awaiting data" },
  ];

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={
            banner.kind === "success"
              ? "flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 p-3"
              : banner.kind === "error"
                ? "flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                : "flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3"
          }
        >
          {banner.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
          ) : banner.kind === "error" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          )}
          <p className="text-sm text-muted-foreground">{banner.text}</p>
        </div>
      )}

      {/* Connection status */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600">
              <GoogleIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold">Google Ads</h2>
              <p className="text-xs text-muted-foreground">
                Amplify approved creator content with paid search &amp; display ads.
              </p>
            </div>
          </div>
          {!hydrated ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : connected ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                <span className="h-2 w-2 rounded-full bg-success" /> Connected
              </span>
              <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>Manage</Button>
              <Button variant="ghost" size="sm" onClick={handleDisconnect}>Disconnect</Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setWizardOpen(true)}>
              <GoogleIcon className="h-4 w-4" /> Connect Google Ads
            </Button>
          )}
        </div>
        {!configured && hydrated && (
          <p className="mt-3 text-xs text-muted-foreground">
            OAuth credentials are not configured yet — sign-in will show instructions until they are added in Vercel.
          </p>
        )}
      </div>

      {!hydrated ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Quick stats */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {stats.map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value} hint={s.hint} />
            ))}
          </div>

          {/* Campaigns */}
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="font-heading text-sm font-semibold">Your campaigns</h3>
              </div>
              <Button size="sm" variant="outline" onClick={() => setWizardOpen(true)} disabled={!connected}>
                <Plus className="h-4 w-4" /> New campaign
              </Button>
            </div>

            {campaigns.length === 0 ? (
              <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background py-10">
                <Unplug className="h-6 w-6 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {connected
                    ? "No campaigns yet — use “New campaign” or “Amplify” on an approved deliverable."
                    : "Connect Google Ads to start amplifying."}
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Campaign</th>
                      <th className="py-2 pr-4 font-medium">Goal</th>
                      <th className="py-2 pr-4 font-medium">Budget</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id} className="border-b border-border/60">
                        <td className="py-3 pr-4 font-medium">
                          {c.google_campaign_name ?? `${c.goal} campaign`}
                          {c.google_campaign_id && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              live
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 capitalize text-muted-foreground">{c.goal}</td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {c.daily_budget_cents ? `£${(c.daily_budget_cents / 100).toFixed(2)}/day` : "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                            {STATUS_LABEL[c.status] ?? c.status}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            {c.status === "paused" ? (
                              <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => campaignAction(c.id, "resume")}>
                                {busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Resume
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => campaignAction(c.id, "pause")}>
                                {busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />} Pause
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" disabled={busyId === c.id} onClick={() => campaignAction(c.id, "inject")}>
                              <Link2 className="h-3.5 w-3.5" /> Inject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Blended analytics */}
          <GoogleAdsAnalytics />

          {/* A/B thumbnail assets */}
          <GoogleAdsAbAssets />

          {/* Google Partner credit */}
          <GoogleAdsPartnerCredits />

          {/* Kill switch */}
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="font-heading text-sm font-semibold">Budget protection (auto-kill switch)</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Adswish pauses your campaign automatically if it breaches these thresholds.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { key: "maxDaily" as const, label: "Max daily spend (£)", min: 10, max: 500 },
                { key: "maxTotal" as const, label: "Max total spend (£)", min: 50, max: 5000 },
                { key: "minConversions" as const, label: "Min conversions before kill", min: 0, max: 10 },
                { key: "minRoas" as const, label: "Pause if ROAS below", min: 0.5, max: 5, step: 0.1 },
              ].map((f) => (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-xs font-medium">{f.label}</span>
                  <input
                    type="number"
                    value={kill[f.key]}
                    min={f.min}
                    max={f.max}
                    step={f.step ?? 1}
                    onChange={(e) => setKill((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button size="sm" onClick={saveKill}>{saved ? "Saved ✓" : "Save settings"}</Button>
              <span className="text-xs text-muted-foreground">
                Protection is active once a campaign is connected.
              </span>
            </div>
          </div>

          {/* Activity log */}
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h3 className="font-heading text-sm font-semibold">Recent activity</h3>
            </div>
            {activity.length === 0 ? (
              <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background py-8">
                <Unplug className="h-6 w-6 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">No activity yet — connect Google Ads to begin.</p>
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 text-sm">
                    <span
                      className={
                        a.kind === "success"
                          ? "text-success"
                          : a.kind === "warning"
                            ? "text-warning"
                            : a.kind === "error"
                              ? "text-destructive"
                              : "text-muted-foreground"
                      }
                    >
                      {a.kind === "success" ? "✓" : a.kind === "warning" ? "⚠" : a.kind === "error" ? "✕" : "•"}
                    </span>
                    <span className="text-muted-foreground">
                      {a.message}{" "}
                      <span className="text-xs text-muted-foreground/60">
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <GoogleAdsWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
