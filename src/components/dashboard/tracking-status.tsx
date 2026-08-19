"use client";

import { useEffect, useState } from "react";
import { Check, X, Minus, Loader2, RefreshCw } from "lucide-react";

type CheckResult = { ok: boolean; enabled?: boolean; label: string; detail: string };

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
  const [loading, setLoading] = useState(true);

  function apply(json: { inhouse: CheckResult; external: CheckResult; thirdParty?: CheckResult; fully_active: boolean }) {
    setInhouse(json.inhouse);
    setExternal(json.external);
    setThirdParty(json.thirdParty ?? null);
    setFully(Boolean(json.fully_active));
  }

  function check() {
    setLoading(true);
    fetch("/api/internal/tracking/status")
      .then((r) => r.json())
      .then((json) => apply(json))
      .catch(() => {
        setInhouse({ ok: false, label: "In-house pixel check", detail: "Could not reach the check API" });
        setExternal({ ok: false, label: "External domain check", detail: "Could not reach the check API" });
        setThirdParty({ ok: false, label: "Third-party uptime check", detail: "Could not reach the check API" });
        setFully(false);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/internal/tracking/status")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) apply(json);
      })
      .catch(() => {
        if (cancelled) return;
        setInhouse({ ok: false, label: "In-house pixel check", detail: "Could not reach the check API" });
        setExternal({ ok: false, label: "External domain check", detail: "Could not reach the check API" });
        setThirdParty({ ok: false, label: "Third-party uptime check", detail: "Could not reach the check API" });
        setFully(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    </div>
  );
}
