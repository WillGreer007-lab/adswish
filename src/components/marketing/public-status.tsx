"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

type HealthCheck = { ok: boolean; detail: string };
type HealthResponse = {
  status: "ok" | "degraded";
  checks: { application: HealthCheck; database: HealthCheck };
  checked_at: string;
};

export function PublicStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState(false);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const json = (await response.json()) as HealthResponse;
      setHealth(json);
      setRequestError(false);
    } catch {
      setRequestError(true);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => void check(), 0);
    const interval = window.setInterval(() => void check(), 60_000);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
    };
  }, [check]);

  const operational = health?.status === "ok" && !requestError;
  const checkedAt = health?.checked_at
    ? new Date(health.checked_at).toLocaleString()
    : null;

  return (
    <main className="min-h-screen bg-background px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="font-heading text-lg font-bold">
          adswish
        </Link>

        <div className="mt-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">System status</p>
          <h1 className="mt-2 font-heading text-4xl font-bold">Adswish status</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Live readiness checks for the Adswish application and database. This page never exposes
            API keys or customer data.
          </p>
        </div>

        <section className="mt-8 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : operational ? (
                <CheckCircle2 className="h-6 w-6 text-success" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-warning" />
              )}
              <div>
                <h2 className="font-heading text-lg font-semibold">
                  {loading ? "Checking systems…" : operational ? "All systems operational" : "Some systems need attention"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {checkedAt ? `Last checked ${checkedAt}` : "Waiting for the first check"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void check()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Check now
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {(["application", "database"] as const).map((key) => {
              const result = health?.checks[key];
              const ok = result?.ok === true;
              return (
                <div key={key} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-success" : loading ? "bg-muted" : "bg-destructive"}`} />
                    <p className="text-sm font-medium">{key === "application" ? "Application" : "Database"}</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {result?.detail ?? (requestError ? "Health endpoint unreachable" : "Checking…")}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <p className="mt-6 text-xs text-muted-foreground">
          Business tracking checks, including verified domains, pixel heartbeats, and optional UptimeRobot
          monitors, are available in <Link href="/login" className="text-primary hover:underline">Tracking settings</Link>.
        </p>
      </div>
    </main>
  );
}
