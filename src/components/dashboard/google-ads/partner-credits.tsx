"use client";

import { useEffect, useState, useCallback } from "react";
import { Gift, Loader2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type CreditState = {
  status: "not_applied" | "applied" | "approved" | "declined";
  creditAmountCents: number;
  appliedAt: string | null;
  notes: string | null;
};

const STATUS_LABEL: Record<CreditState["status"], string> = {
  not_applied: "Not applied",
  applied: "Application submitted",
  approved: "Approved — credit granted",
  declined: "Declined",
};

export function GoogleAdsPartnerCredits() {
  const [credit, setCredit] = useState<CreditState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/internal/google-ads/partner-credits");
      if (res.ok) {
        setCredit((await res.json()) as CreditState);
      }
    } catch {
      /* leave the empty state */
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

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/google-ads/partner-credits", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not apply for the credit.");
        return;
      }
      setCredit({ status: data.status, creditAmountCents: data.creditAmountCents, appliedAt: new Date().toISOString(), notes: null });
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-surface py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const amount = credit ? `£${(credit.creditAmountCents / 100).toFixed(0)}` : "£500";

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Gift className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-sm font-semibold">Google Partner credit</h3>
            <p className="mt-0.5 max-w-md text-xs text-muted-foreground">
              Eligible businesses can get a {amount} Google Ads credit toward their first amplified campaign
              through the Google Partners program.
            </p>
          </div>
        </div>
        <div className="text-right">
          {credit ? (
            <span
              className={
                credit.status === "approved"
                  ? "inline-flex items-center gap-1.5 text-xs font-medium text-success"
                  : credit.status === "declined"
                    ? "inline-flex items-center gap-1.5 text-xs font-medium text-destructive"
                    : "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
              }
            >
              {credit.status === "approved" || credit.status === "applied" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {STATUS_LABEL[credit.status]}
            </span>
          ) : null}
          {credit?.status === "not_applied" && (
            <Button size="sm" className="mt-1.5" disabled={busy} onClick={apply}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />} Apply for credit
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {credit?.status === "applied" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Your application was submitted — we&apos;ll review it against the Google Partners eligibility criteria and
          update the status here.
        </p>
      )}
    </div>
  );
}
