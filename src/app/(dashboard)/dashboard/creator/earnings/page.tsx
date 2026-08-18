import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell, EmptyState } from "@/components/dashboard/dashboard-shell";
import { Wallet, Clock3, CircleDollarSign, FileText } from "lucide-react";

type LedgerRow = {
  id: string;
  type: string;
  amount: number;
  created_at: string;
};

type InvoiceRow = {
  id: string;
  month_start: string;
  month_end: string;
  total_released: number;
  pdf_url: string | null;
  sent_at: string | null;
};

const ledgerLabels: Record<string, { label: string; cls: string }> = {
  hold: { label: "Hold", cls: "text-warning" },
  release: { label: "Release", cls: "text-success" },
  refund: { label: "Refund", cls: "text-muted-foreground" },
  chargeback_clawback: { label: "Clawback", cls: "text-destructive" },
  platform_fee: { label: "Platform fee", cls: "text-muted-foreground" },
  stripe_fee: { label: "Stripe fee", cls: "text-muted-foreground" },
  subscription_revenue: { label: "Subscription", cls: "text-primary" },
};

export default async function CreatorEarningsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard");

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("display_name, onboarding_step")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.onboarding_step !== "complete") redirect("/onboarding");

  const [ledgerRes, invoicesRes] = await Promise.all([
    supabase
      .from("ledger_entries")
      .select("id, type, amount, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("payout_invoices")
      .select("id, month_start, month_end, total_released, pdf_url, sent_at")
      .order("month_start", { ascending: false })
      .limit(24),
  ]);

  const ledger = (ledgerRes.data ?? []) as LedgerRow[];
  const invoices = (invoicesRes.data ?? []) as InvoiceRow[];

  const held = ledger.filter((l) => l.type === "hold").reduce((s, l) => s + Number(l.amount), 0);
  const released = ledger
    .filter((l) => l.type === "release")
    .reduce((s, l) => s + Number(l.amount), 0);
  const clawedBack = ledger
    .filter((l) => l.type === "refund" || l.type === "chargeback_clawback")
    .reduce((s, l) => s + Number(l.amount), 0);

  return (
    <DashboardShell role="creator" userId={user.id} userName={profile.display_name}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Earnings</h1>
          <p className="text-sm text-muted-foreground">
            Released payouts, funds on hold, and monthly payout invoices.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <CircleDollarSign className="h-4 w-4" /> Released
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-success">${released.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Clock3 className="h-4 w-4" /> On hold
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-warning">${held.toFixed(2)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Holds release automatically after the conversion window.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Wallet className="h-4 w-4" /> Clawbacks
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-destructive">${clawedBack.toFixed(2)}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-heading text-sm font-semibold">Recent ledger activity</h2>
          </div>
          {ledger.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Wallet}
                title="No activity yet"
                description="Once your campaigns start converting, your earnings will appear here."
              />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {ledger.map((l) => {
                const meta = ledgerLabels[l.type] ?? { label: l.type, cls: "text-muted-foreground" };
                return (
                  <div key={l.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className={`text-sm font-medium ${meta.cls}`}>{meta.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(l.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="font-mono text-sm font-semibold">
                      {Number(l.amount) < 0 ? "-" : "+"}${Math.abs(Number(l.amount)).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-heading text-sm font-semibold">Payout invoices</h2>
          </div>
          {invoices.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              No monthly payout invoices yet. Invoices are generated once a month for released earnings.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(inv.month_start).toLocaleDateString()} —{" "}
                      {new Date(inv.month_end).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {inv.sent_at ? `Sent ${new Date(inv.sent_at).toLocaleDateString()}` : "Not sent yet"}
                    </p>
                  </div>
                  <p className="font-mono text-sm font-semibold">${Number(inv.total_released).toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
