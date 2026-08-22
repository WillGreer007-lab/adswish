"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X, Minus, Loader2, RefreshCw } from "lucide-react";

type CheckResult = { ok: boolean; enabled?: boolean; label: string; detail: string };
type DiagnosticResult = { ok: boolean; detail: string; enabled?: boolean; configured?: boolean };
type Diagnostics = {
  application: DiagnosticResult;
  database: DiagnosticResult;
  verifiedDomain: DiagnosticResult;
  monitorMapping: DiagnosticResult;
  externalMonitor: DiagnosticResult;
};

function StatusRow({ result, optional }: { result: CheckResult | null; optional?: boolean }) {
  const ok = result?.ok;
  const muted = optional && result?.enabled === false;
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full ${
          muted ? "bg-muted text-muted-foreground" : ok ? "bg-success/15 text-success" : ok === false ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
        }`}
      >
        {muted ? <Minus className="h-4 w-4" /> : ok === true ? <Check className="h-4 w-4" /> : ok === false ? <X className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{result?.label ?? "Checking…"}</p>
        <p className="text-xs text-muted-foreground">{result?.detail ?? ""}</p>
      </div>
    </div>
  );
}

export function TrackingStatus() {
  const [inhouse, setInhouse] = useState<CheckResult | null>(null);
  const [external, setExternal] = useState<CheckResult | null>(null);
  const [thirdParty, setThirdParty] = useState<CheckResult | null>(null);
  const [fully, setFully] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);

  function apply(json: {
    inhouse: CheckResult;
    external: CheckResult;
    thirdParty?: CheckResult;
    diagnostics?: Diagnostics;
    fully_active: boolean;
  }) {
    setInhouse(json.inhouse);
    setExternal(json.external);
    setThirdParty(json.thirdParty ?? null);
    setDiagnostics(json.diagnostics ?? null);
    setFully(Boolean(json.fully_active));
  }

  function setFailureState(detail: string) {
    setInhouse({ ok: false, label: "In-house pixel check", detail });
    setExternal({ ok: false, label: "External domain check", detail });
    setThirdParty({ ok: false, label: "Third-party uptime check", detail });
    setDiagnostics(null);
    setFully(false);
  }

  const check = useCallback(() => {
    setLoading(true);
    fetch("/api/internal/tracking/status")
      .then((r) => r.json())
      .then((json) => apply(json))
      .catch(() => setFailureState("Could not reach the check API"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/internal/tracking/status")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) apply(json);
      })
      .catch(() => {
        if (!cancelled) setFailureState("Could not reach the check API");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onMonitorUpdated = () => check();
    window.addEventListener("adswish:tracking-monitor-updated", onMonitorUpdated);
    return () => window.removeEventListener("adswish:tracking-monitor-updated", onMonitorUpdated);
  }, [check]);

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${fully ? "bg-success pulse-green" : "bg-destructive"}`} />
          <h2 className="font-heading text-sm font-semibold">Tracking verification</h2>
        </div>
        <button
          type="button"
          onClick={check}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Check again
        </button>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Both checks must be green before affiliate and hybrid campaigns can be launched.
        The third-party check is optional and only gates tracking once configured.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatusRow result={inhouse} />
        <StatusRow result={external} />
        <StatusRow result={thirdParty} optional />
      </div>

      {diagnostics && (
        <details className="mt-5 rounded-md border border-border bg-background p-3">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
            View tracking diagnostics
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(diagnostics).map(([key, result]) => (
              <div key={key} className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${result.ok ? "bg-success" : "bg-destructive"}`} />
                  <p className="text-xs font-medium">
                    {key === "verifiedDomain"
                      ? "Verified domain"
                      : key === "monitorMapping"
                        ? "Monitor mapping"
                        : key === "externalMonitor"
                          ? "External monitor"
                          : key === "application"
                            ? "Application"
                            : "Database"}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{result.detail}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
