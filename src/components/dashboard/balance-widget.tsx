"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Plus, ArrowUpRight, Loader2 } from "lucide-react";

type Txn = {
  id: string;
  type: string;
  amount_cents: number;
  balance_after_cents: number;
  description: string | null;
  created_at: string;
};

type Cashout = {
  id: string;
  amount_cents: number;
  fee_cents: number;
  net_cents: number;
  status: string;
  created_at: string;
};

const money = (cents: number) => `£${(cents / 100).toFixed(2)}`;

const PRESETS = [500, 2000, 5000, 10000]; // £5, £20, £50, £100

export function BalanceWidget() {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [minCashout, setMinCashout] = useState(1000);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [cashouts, setCashouts] = useState<Cashout[]>([]);
  const [topupCents, setTopupCents] = useState(5000);
  const [cashoutCents, setCashoutCents] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function connectPayout() {
    setBusy("connect");
    try {
      const res = await fetch("/api/internal/stripe/connect-link", { method: "POST" });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else setMessage(json.error || "Could not start payout account setup");
    } finally {
      setBusy(null);
    }
  }

  function apply(json: { balance_cents: number; min_cashout_cents?: number; transactions?: Txn[]; cashouts?: Cashout[] }) {
    setBalance(json.balance_cents);
    setMinCashout(json.min_cashout_cents ?? 1000);
    setTxns(json.transactions ?? []);
    setCashouts(json.cashouts ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/internal/balance")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) apply(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function topUp() {
    setBusy("topup");
    setMessage(null);
    try {
      const res = await fetch("/api/internal/balance/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: topupCents }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setMessage(json.error || "Top-up failed");
    } finally {
      setBusy(null);
    }
  }

  async function cashOut() {
    const cents = Math.round(Number(cashoutCents) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return;
    setBusy("cashout");
    setMessage(null);
    try {
      const res = await fetch("/api/internal/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: cents }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage(
          `Cash-out requested: ${money(json.net_cents)} to you (${money(json.fee_cents)} fee).`,
        );
        setCashoutCents("");
        const fresh = await fetch("/api/internal/balance").then((r) => r.json());
        apply(fresh);
        router.refresh();
      } else {
        setMessage(json.error || "Cash-out failed");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-5 sm:col-span-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Wallet className="h-4 w-4" /> Wallet balance
          </div>
          <p className="mt-2 font-mono text-3xl font-bold">
            {balance === null ? "—" : money(balance)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Used only for fixed-fee campaign payouts and cash-outs.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 sm:col-span-2">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-heading text-sm font-semibold">Top up</h3>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTopupCents(p)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                  topupCents === p
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {money(p)}
              </button>
            ))}
            <button
              type="button"
              onClick={topUp}
              disabled={busy === "topup"}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
            >
              {busy === "topup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add {money(topupCents)}
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-heading text-sm font-semibold">Cash out (90/10)</h3>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={cashoutCents}
              onChange={(e) => setCashoutCents(e.target.value)}
              placeholder={`Min ${money(minCashout)}`}
              inputMode="decimal"
              className="w-40 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={cashOut}
              disabled={busy === "cashout"}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
            >
              {busy === "cashout" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
              Request cash-out
            </button>
          </div>
          {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}

          <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={connectPayout}
              disabled={busy === "connect"}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/50 disabled:opacity-60"
            >
              {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              Connect / manage payout account
            </button>
            <p className="text-xs text-muted-foreground">Required for cash-outs to reach your bank.</p>
          </div>
        </div>
      </div>

      {txns.length > 0 && (
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h3 className="font-heading text-sm font-semibold">Balance history</h3>
          </div>
          <div className="divide-y divide-border">
            {txns.slice(0, 12).map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium capitalize">{t.type.replace("_", " ")}</p>
                  <p className="text-xs text-muted-foreground">{t.description || new Date(t.created_at).toLocaleDateString()}</p>
                </div>
                <p className={`font-mono text-sm font-semibold ${t.amount_cents >= 0 ? "text-success" : "text-destructive"}`}>
                  {t.amount_cents >= 0 ? "+" : ""}
                  {money(t.amount_cents)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
