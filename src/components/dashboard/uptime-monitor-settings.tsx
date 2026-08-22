"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Save, X } from "lucide-react";

export function UptimeMonitorSettings({
  initialMonitorId,
  verifiedDomain,
}: {
  initialMonitorId: string | null;
  verifiedDomain: string | null;
}) {
  const [monitorId, setMonitorId] = useState(initialMonitorId ?? "");
  const [savedId, setSavedId] = useState(initialMonitorId ?? "");
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
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

  async function createOrUpdateMonitor() {
    setProvisioning(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/internal/business/uptime-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert" }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        uptime_robot_monitor_id?: string;
        action?: "created" | "updated";
      };
      if (!response.ok) {
        setError(data.error ?? "Could not create the UptimeRobot monitor.");
        return;
      }
      const nextId = data.uptime_robot_monitor_id ?? "";
      setMonitorId(nextId);
      setSavedId(nextId);
      setMessage(data.action === "updated" ? "Uptime monitor updated." : "Uptime monitor created and mapped.");
      window.dispatchEvent(new CustomEvent("adswish:tracking-monitor-updated"));
    } catch {
      setError("Network error — could not create the UptimeRobot monitor.");
    } finally {
      setProvisioning(false);
    }
  }

  const dirty = monitorId.trim() !== savedId;

  return (
    <div className="mt-5 rounded-md border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Map a specific UptimeRobot monitor</h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Optional: enter the numeric monitor ID from UptimeRobot to use that monitor for this
            business. This is useful when the monitor URL differs from your verified domain or
            redirects through another hostname. If empty, Adswish matches the verified domain by hostname.
          </p>
        </div>
        {savedId && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            <Check className="h-3.5 w-3.5" /> Mapped
          </span>
        )}
      </div>

      {verifiedDomain && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground">
            Prefer one-click setup? Adswish can create or update an HTTP monitor for{" "}
            <span className="font-medium text-foreground">{verifiedDomain}</span> using the server-side monitor-management key.
          </p>
          <button
            type="button"
            onClick={createOrUpdateMonitor}
            disabled={provisioning || saving}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/40 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {provisioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {savedId ? "Update monitor" : "Create monitor"}
          </button>
        </div>
      )}

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
