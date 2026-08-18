"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type TrackingMethod = "script" | "extension";

export function TrackingMethodToggle({ current }: { current: TrackingMethod }) {
  const [method, setMethod] = useState<TrackingMethod>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function choose(next: TrackingMethod) {
    if (next === method || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/business/tracking-method", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracking_method: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to save");
      }
      setMethod(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const options: { value: TrackingMethod; label: string; desc: string }[] = [
    { value: "script", label: "Pixel script", desc: "Tracks every visitor" },
    { value: "extension", label: "Chrome extension", desc: "No site code" },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={saving}
            onClick={() => choose(o.value)}
            className={cn(
              "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
              method === o.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/40",
            )}
          >
            {o.label}
            <span className="ml-1.5 text-xs opacity-70">— {o.desc}</span>
          </button>
        ))}
      </div>
      {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Your guides below follow this choice. Only one tracking method should be
        active at a time.
      </p>
    </div>
  );
}
