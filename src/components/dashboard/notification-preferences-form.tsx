"use client";

import { useEffect, useState } from "react";
import { BellOff, Mail, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPES = [
  { value: "payment", label: "Payments" },
  { value: "application", label: "Applications" },
  { value: "sla", label: "SLA & deadlines" },
  { value: "pixel_offline", label: "Pixel offline" },
  { value: "review", label: "Reviews" },
  { value: "message", label: "Messages" },
  { value: "system", label: "System" },
] as const;

interface Prefs {
  muted_types: string[];
  email_enabled: boolean;
  push_enabled: boolean;
}

export function NotificationPreferencesForm() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/internal/notification-preferences")
      .then((r) => r.json())
      .then((data) => setPrefs({ muted_types: data?.muted_types ?? [], email_enabled: data?.email_enabled ?? true, push_enabled: data?.push_enabled ?? true }))
      .catch(() => setError("Could not load preferences"));
  }, []);

  async function save(next: Prefs) {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/internal/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("Save failed");
      setPrefs(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function toggleType(value: string) {
    if (!prefs) return;
    const muted = prefs.muted_types.includes(value)
      ? prefs.muted_types.filter((t) => t !== value)
      : [...prefs.muted_types, value];
    save({ ...prefs, muted_types: muted });
  }

  if (!prefs) {
    return (
      <div className="rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground">
        {error ?? "Loading preferences…"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <BellOff className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-heading text-sm font-semibold">Muted notification types</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {TYPES.map((t) => {
            const muted = prefs.muted_types.includes(t.value);
            return (
              <button
                key={t.value}
                type="button"
                disabled={saving}
                onClick={() => toggleType(t.value)}
                className={cn(
                  "flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors",
                  muted
                    ? "border-border bg-muted text-muted-foreground line-through"
                    : "border-border bg-background hover:border-primary/40",
                )}
              >
                {t.label}
                <span className={cn("text-xs", muted ? "text-destructive" : "text-success")}>
                  {muted ? "Muted" : "On"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => save({ ...prefs, email_enabled: !prefs.email_enabled })}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-primary/40"
        >
          <Mail className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Email notifications</p>
            <p className="text-xs text-muted-foreground">
              {prefs.email_enabled ? "Enabled" : "Disabled"}
            </p>
          </div>
          <span className={cn("h-5 w-9 rounded-full p-0.5 transition-colors", prefs.email_enabled ? "bg-primary" : "bg-muted")}>
            <span className={cn("block h-4 w-4 rounded-full bg-white transition-transform", prefs.email_enabled && "translate-x-4")} />
          </span>
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => save({ ...prefs, push_enabled: !prefs.push_enabled })}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-primary/40"
        >
          <Smartphone className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Push notifications</p>
            <p className="text-xs text-muted-foreground">
              {prefs.push_enabled ? "Enabled" : "Disabled"}
            </p>
          </div>
          <span className={cn("h-5 w-9 rounded-full p-0.5 transition-colors", prefs.push_enabled ? "bg-primary" : "bg-muted")}>
            <span className={cn("block h-4 w-4 rounded-full bg-white transition-transform", prefs.push_enabled && "translate-x-4")} />
          </span>
        </button>
      </div>

      {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
      {saved && <p className="text-xs text-success">✓ Saved</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
