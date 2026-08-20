"use client";

import { useEffect, useState, useCallback } from "react";
import { ImagePlus, Loader2, Check, RefreshCw, Clapperboard, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type AssetRow = {
  id: string;
  variant: string;
  image_url: string | null;
  status: string;
  error: string | null;
  selected: boolean;
};

type DeliverableRow = {
  id: string;
  campaign_id: string;
  campaign_title: string | null;
  status: string;
  video_url: string | null;
  assets: AssetRow[];
};

const VARIANT_LABEL: Record<string, string> = {
  variant_a: "A",
  variant_b: "B",
  variant_c: "C",
};

export function GoogleAdsAbAssets() {
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/internal/google-ads/thumbnails");
      if (res.ok) {
        const json = (await res.json()) as { deliverables: DeliverableRow[] };
        setDeliverables(json.deliverables ?? []);
      }
    } catch {
      /* empty state */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      load().finally(() => {
        if (!cancelled) setLoaded(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function generate(deliverableId: string) {
    setBusyId(deliverableId);
    setMessage(null);
    try {
      const res = await fetch("/api/internal/google-ads/thumbnails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverable_id: deliverableId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: "error", text: data.error || "Thumbnail generation failed." });
        return;
      }
      setMessage({
        kind: "success",
        text: `${data.generated ?? 3} thumbnail${(data.generated ?? 3) === 1 ? "" : "s"} generated.`,
      });
      await load();
    } catch {
      setMessage({ kind: "error", text: "Network error." });
    } finally {
      setBusyId(null);
    }
  }

  async function select(assetId: string) {
    setBusyId(assetId);
    setMessage(null);
    try {
      const res = await fetch(`/api/internal/google-ads/thumbnails/${assetId}/select`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage({ kind: "error", text: data.error || "Could not select the thumbnail." });
        return;
      }
      setMessage({ kind: "success", text: "Thumbnail selected for the ad creative." });
      await load();
    } catch {
      setMessage({ kind: "error", text: "Network error." });
    } finally {
      setBusyId(null);
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-surface py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (deliverables.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <Clapperboard className="h-5 w-5 text-primary" />
          <h3 className="font-heading text-sm font-semibold">A/B thumbnail assets</h3>
        </div>
        <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background py-8">
          <ImagePlus className="h-6 w-6 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            Approved deliverables with videos will appear here — generate three thumbnail variants to A/B test in your ads.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Clapperboard className="h-5 w-5 text-primary" />
        <h3 className="font-heading text-sm font-semibold">A/B thumbnail assets</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Extract three frames from an approved deliverable&apos;s video and pick the winner for your ad creative.
      </p>

      {message && (
        <div
          className={
            message.kind === "success"
              ? "mt-3 flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success"
              : "mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          }
        >
          {message.kind === "success" ? (
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="mt-4 space-y-6">
        {deliverables.map((d) => {
          const ready = d.assets.filter((a) => a.status === "ready");
          const failed = d.assets.find((a) => a.status === "failed");
          return (
            <div key={d.id} className="rounded-lg border border-border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {d.campaign_title ?? "Campaign"} <span className="text-muted-foreground">· {d.status}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Deliverable {d.id.slice(0, 8)}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === d.id}
                  onClick={() => generate(d.id)}
                >
                  {busyId === d.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : ready.length > 0 ? (
                    <RefreshCw className="h-3.5 w-3.5" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  {ready.length > 0 ? "Regenerate" : "Generate thumbnails"}
                </Button>
              </div>

              {failed && !ready.length && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>{failed.error}</span>
                </div>
              )}

              {ready.length > 0 && (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {ready.map((a) => (
                    <div key={a.id} className="overflow-hidden rounded-lg border border-border">
                      {a.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.image_url} alt={`Thumbnail variant ${VARIANT_LABEL[a.variant] ?? a.variant}`} className="aspect-video w-full bg-muted object-cover" />
                      ) : (
                        <div className="flex aspect-video w-full items-center justify-center bg-muted text-xs text-muted-foreground">No image</div>
                      )}
                      <div className="flex items-center justify-between border-t border-border bg-surface px-2.5 py-2">
                        <span className="text-xs font-semibold">Variant {VARIANT_LABEL[a.variant] ?? a.variant}</span>
                        {a.selected ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                            <Check className="h-3.5 w-3.5" /> Selected
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            disabled={busyId === a.id}
                            onClick={() => select(a.id)}
                          >
                            Use this
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
