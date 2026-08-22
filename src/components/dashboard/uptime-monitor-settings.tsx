"use client";

import { useState } from "react";
import { Check, Loader2, Save, X } from "lucide-react";

export function UptimeMonitorSettings({
  initialMonitorId,
}: {
  initialMonitorId: string | null;
}) {
  const [monitorId, setMonitorId] = useState(initialMonitorId ?? "");
  const [savedId, setSavedId] = useState(initialMonitorId ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const value = monitorId.trim();
    if (value && !/^\d+$/.test(value)) {
      setError("Enter the numeric monitor ID shown in UptimeRobot.");
      setMessage(null);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/internal/business/uptime-monitor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uptime_robot_monitor_id: value }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not save the monitor mapping.");
        return;
      }
      setSavedId(value);
      setMonitorId(value);
      setMessage(value ? "Monitor mapping saved." : "Monitor mapping cleared.");
      window.dispatchEvent(new CustomEvent("adswish:tracking-monitor-updated"));
    } catch {
      setError("Network error — could not save the monitor mapping.");
    } finally {
      setSaving(false);
    }
  }

  const dirty = monitorId.trim() !== savedId;

  return (
    <div className="mt-5 rounded-md border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Map your UptimeRobot monitor</h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Monitor-only mode checks one explicitly mapped monitor. Create the HTTP(s) monitor in
            UptimeRobot yourself, then enter its numeric ID here. Adswish does not access your
            UptimeRobot account, create monitors, or inspect unrelated monitors.
          </p>
        </div>
        {savedId && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            <Check className="h-3.5 w-3.5" /> Mapped
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Monitor ID</span>
          <input
            value={monitorId}
            onChange={(event) => {
              setMonitorId(event.target.value);
              setMessage(null);
              setError(null);
            }}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="e.g. 123456789"
            aria-label="UptimeRobot monitor ID"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none ring-primary/30 placeholder:text-muted-foreground/60 focus:ring-2"
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save mapping
        </button>
        {savedId && (
          <button
            type="button"
            onClick={() => {
              setMonitorId("");
              setMessage(null);
              setError(null);
            }}
            disabled={saving || !monitorId}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      {message && <p className="mt-2 text-xs text-success">{message}</p>}
    </div>
  );
}
