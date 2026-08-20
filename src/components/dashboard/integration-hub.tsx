"use client";

import { useEffect, useState } from "react";
import { Lock, Check, Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CRITICAL_INTEGRATIONS,
  OPTIONAL_INTEGRATIONS,
  integrationLimitForPlan,
  type IntegrationDef,
} from "@/lib/integrations";
import { IntegrationLogo, type LogoName } from "./integration-logos";

/** Map an integration key to its brand logo. */
const LOGO_FOR: Record<string, LogoName> = {
  stripe: "stripe",
  resend: "resend",
  supabase: "supabase",
  upstash: "upstash",
  sightengine: "sightengine",
  google_ads: "google_ads",
  meta_ads: "meta_ads",
  tiktok_ads: "tiktok_ads",
  youtube_ads: "youtube_ads",
  instagram_ads: "instagram_ads",
  x_ads: "x_ads",
  linkedin_ads: "linkedin_ads",
  pinterest_ads: "pinterest_ads",
  snapchat_ads: "snapchat_ads",
};

function LogoTile({
  integration,
  className,
}: {
  integration: IntegrationDef;
  className?: string;
}) {
  const logo = LOGO_FOR[integration.key];
  return (
    <div
      className={cn(
        "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
        className,
      )}
    >
      {logo ? (
        <IntegrationLogo name={logo} className="h-6 w-6" />
      ) : (
        <span className="text-base font-bold">{integration.mark}</span>
      )}
    </div>
  );
}

function CoreCard({ integration }: { integration: IntegrationDef }) {
  return (
    <div className="relative flex flex-col rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-3">
        <LogoTile integration={integration} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-heading text-sm font-semibold">{integration.name}</h3>
            <Lock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{integration.description}</p>
        </div>
      </div>
      <div className="mt-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success" /> Connected · managed by Adswish
        </span>
      </div>
    </div>
  );
}

type AddState = "idle" | "adding" | "removing";

function OptionalCard({
  integration,
  added,
  busy,
  onAdd,
  onRemove,
}: {
  integration: IntegrationDef;
  added: boolean;
  busy: AddState;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-surface p-5 transition-colors",
        added ? "border-success/40 bg-success/[0.03]" : "border-border",
      )}
    >
      <div className="flex items-center gap-3">
        <LogoTile integration={integration} />
        <div className="min-w-0">
          <h3 className="truncate font-heading text-sm font-semibold">{integration.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{integration.description}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        {added ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
            <Check className="h-3.5 w-3.5" /> Added
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Not connected
          </span>
        )}

        {added ? (
          <button
            onClick={onRemove}
            disabled={busy === "removing"}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
          >
            {busy === "removing" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Remove
          </button>
        ) : (
          <button
            onClick={onAdd}
            disabled={busy === "adding"}
            className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-success/90 disabled:opacity-60"
          >
            {busy === "adding" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Add
          </button>
        )}
      </div>
    </div>
  );
}

export function IntegrationHub({ planSlug, planName }: { planSlug: string; planName: string }) {
  const limit = integrationLimitForPlan(planSlug);
  const criticalCount = CRITICAL_INTEGRATIONS.length;

  const [added, setAdded] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<Record<string, AddState>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Defer the fetch so the first (server-matching) render stays identical
      // and the persisted "added" set is applied in a follow-up microtask.
      await Promise.resolve();
      if (cancelled) return;
      try {
        const res = await fetch("/api/internal/integrations", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { added: { key: string }[] };
          setAdded(new Set(data.added.map((r) => r.key)));
        }
      } catch {
        /* offline — keep the empty state */
      } finally {
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function addIntegration(key: string) {
    setBusy((b) => ({ ...b, [key]: "adding" }));
    setApiError(null);
    try {
      const res = await fetch("/api/internal/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setApiError(data.error ?? "Could not add integration.");
        return;
      }
      setAdded((prev) => new Set(prev).add(key));
    } catch {
      setApiError("Network error — could not add integration.");
    } finally {
      setBusy((b) => ({ ...b, [key]: "idle" }));
    }
  }

  async function removeIntegration(key: string) {
    setBusy((b) => ({ ...b, [key]: "removing" }));
    setApiError(null);
    try {
      const res = await fetch(`/api/internal/integrations?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setApiError(data.error ?? "Could not remove integration.");
        return;
      }
      setAdded((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } catch {
      setApiError("Network error — could not remove integration.");
    } finally {
      setBusy((b) => ({ ...b, [key]: "idle" }));
    }
  }

  const used = criticalCount + added.size;
  const remaining = Math.max(0, limit - used);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-heading text-sm font-semibold">
              {used} of {limit} integrations in use
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {remaining > 0
                ? `${remaining} optional integration slot${remaining === 1 ? "" : "s"} available on your ${planName} plan.`
                : "You've used all your integration slots on this plan."}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Check className="h-3.5 w-3.5" /> {planName} plan
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
          />
        </div>
      </div>

      {apiError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {apiError}
        </div>
      )}

      <div>
        <h2 className="mb-3 font-heading text-sm font-semibold text-muted-foreground">
          Core integrations
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CRITICAL_INTEGRATIONS.map((i) => (
            <CoreCard key={i.key} integration={i} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-heading text-sm font-semibold text-muted-foreground">
          Available integrations
        </h2>
        {!loaded ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading integrations...
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {OPTIONAL_INTEGRATIONS.map((i) => (
              <OptionalCard
                key={i.key}
                integration={i}
                added={added.has(i.key)}
                busy={busy[i.key] ?? "idle"}
                onAdd={() => addIntegration(i.key)}
                onRemove={() => removeIntegration(i.key)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
