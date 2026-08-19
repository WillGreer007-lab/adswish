"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function PlanUpgradeButton({ planSlug, label, current }: { planSlug: string; label: string; current: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upgrade() {
    if (loading || current) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/stripe/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_slug: planSlug }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        throw new Error(body?.error || "Could not start checkout");
      }
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  if (current) {
    return (
      <span className="inline-flex items-center rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground">
        Current plan
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={upgrade}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {label}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
