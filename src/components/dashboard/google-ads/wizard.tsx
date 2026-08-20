"use client";

import { useState } from "react";
import { X, Rocket, Plug, Sparkles, CheckCircle2, Info, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/ui/google-icon";
import { cn } from "@/lib/utils";

type Tab = "create" | "inject";

const GOALS = [
  { value: "search", label: "Capture Search Traffic (Text Ads)" },
  { value: "social", label: "Drive Social Discovery (YouTube Shorts / Demand Gen)" },
  { value: "pmax", label: "Maximize Everywhere (Performance Max)" },
];

export function GoogleAdsWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("create");
  const [goal, setGoal] = useState(GOALS[0].value);
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function save(launch: boolean) {
    const dailyBudget = Number(budget);
    if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) {
      setNotice({ kind: "error", text: "Enter a daily budget first." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/internal/google-ads/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, location, dailyBudget, launch }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ kind: "error", text: data.error || "Could not save the campaign." });
        return;
      }
      setNotice({
        kind: "success",
        text: launch
          ? (data.note ?? "Campaign launched in Google Ads. Your tracking is configured.")
          : "Draft saved. Open the Google Ads dashboard to review or launch it.",
      });
    } catch {
      setNotice({ kind: "error", text: "Network error — please try again." });
    } finally {
      setSaving(false);
    }
  }

  function close() {
    setNotice(null);
    setTab("create");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <GoogleIcon className="h-5 w-5" />
            <div>
              <h2 className="font-heading text-base font-bold">Amplify with Google Ads</h2>
              <p className="text-xs text-muted-foreground">Turn an approved post into a paid ad. Zero setup fees.</p>
            </div>
          </div>
          <button onClick={close} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview notice */}
        <div className="flex items-start gap-2 border-b border-border bg-warning/5 px-6 py-3">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
          <p className="text-xs text-muted-foreground">
            Launching pushes the campaign to Google Ads — this needs the developer token (Ads API Center).
            Drafts are saved locally and can be launched later.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border px-6 pt-3">
          <button
            onClick={() => setTab("create")}
            className={cn(
              "flex items-center gap-1.5 rounded-t-md border-b-2 px-3 pb-2 text-sm font-medium transition-colors",
              tab === "create" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Rocket className="h-4 w-4" /> Create new ad
          </button>
          <button
            onClick={() => setTab("inject")}
            className={cn(
              "flex items-center gap-1.5 rounded-t-md border-b-2 px-3 pb-2 text-sm font-medium transition-colors",
              tab === "inject" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Plug className="h-4 w-4" /> Link existing ad
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Sign in with Google */}
          <div className="mb-5 flex flex-col items-start gap-2 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Step 1 — Sign in with Google</p>
              <p className="text-xs text-muted-foreground">Connect the Google Ads account you want to amplify from.</p>
            </div>
            {/* Full-page navigation is required here: the route 302-redirects to Google OAuth. */}
            {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination */}
            <Button variant="outline" size="sm" onClick={() => (window.location.href = "/api/internal/google-ads/connect")}>
              <GoogleIcon className="h-4 w-4" /> Sign in with Google
            </Button>
          </div>

          {tab === "create" ? (
            <div className="space-y-4">
              <p className="font-heading text-sm font-semibold text-muted-foreground">
                The &quot;Magic&quot; Builder — three inputs, no copy needed.
              </p>

              <label className="block">
                <span className="mb-1 block text-xs font-medium">Where should your ad appear?</span>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {GOALS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium">Target location</span>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Country or city, e.g. United Kingdom"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium">Daily budget</span>
                <input
                  type="number"
                  min="1"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 50"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <Button variant="outline" className="flex-1" disabled={saving} onClick={() => save(false)}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save as Draft
                </Button>
                <Button className="flex-1" disabled={saving} onClick={() => save(true)}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Launch Campaign Now
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="font-heading text-sm font-semibold text-muted-foreground">
                The Seamless Injector — add tracking to a campaign you already run.
              </p>
              <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center">
                <Plug className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Your active Google Ads campaigns will appear here after you connect.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Then you&apos;ll be able to inject Adswish tracking with one click — no URL editing.
                </p>
              </div>
            </div>
          )}

          {notice && (
            <div
              className={
                notice.kind === "error"
                  ? "mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                  : "mt-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3"
              }
            >
              {notice.kind === "error" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              )}
              <p className="text-sm text-muted-foreground">{notice.text}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
