import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell, EmptyState } from "@/components/dashboard/dashboard-shell";
import { Wallet, CreditCard, PiggyBank, ArrowLeftRight } from "lucide-react";

type LedgerRow = {
  id: string;
  type: string;
  amount: number;
  created_at: string;
};

const ledgerLabels: Record<string, { label: string; cls: string }> = {
  hold: { label: "Escrow hold", cls: "text-warning" },
  release: { label: "Paid to creator", cls: "text-success" },
  refund: { label: "Refund", cls: "text-muted-foreground" },
  chargeback_clawback: { label: "Clawback", cls: "text-destructive" },
  platform_fee: { label: "Platform fee", cls: "text-primary" },
  stripe_fee: { label: "Stripe fee", cls: "text-muted-foreground" },
};

export default async function BusinessPaymentsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard");

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("company_name, onboarding_step, verified_domain")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.onboarding_step !== "complete") redirect("/onboarding");

  const { data: ledgerRes } = await supabase
    .from("ledger_entries")
    .select("id, type, amount, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const ledger = (ledgerRes ?? []) as LedgerRow[];

  const held = ledger.filter((l) => l.type === "hold").reduce((s, l) => s + Number(l.amount), 0);
  const paid = ledger.filter((l) => l.type === "release").reduce((s, l) => s + Number(l.amount), 0);
  const fees = ledger
    .filter((l) => l.type === "platform_fee" || l.type === "stripe_fee")
    .reduce((s, l) => s + Number(l.amount), 0);

  return (
    <DashboardShell role="business" userId={user.id} userName={profile.company_name}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Escrow, creator payouts, and platform fees on your campaigns.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <PiggyBank className="h-4 w-4" /> In escrow
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-warning">${held.toFixed(2)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Released to creators when deliverables are approved.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Wallet className="h-4 w-4" /> Paid to creators
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-success">${paid.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <ArrowLeftRight className="h-4 w-4" /> Fees
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-primary">${fees.toFixed(2)}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-heading text-sm font-semibold">Payout account</h2>
          </div>
          {profile.verified_domain ? (
            <p className="mt-2 text-sm text-success">✓ Domain verified ({profile.verified_domain}). Payouts are sent after deliverable approval.</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Payment setup happens during onboarding (Step 4). You can connect Stripe there or from this page later.
            </p>
          )}
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
                description="Once creators start converting and deliverables are approved, activity will appear here."
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
                      ${Math.abs(Number(l.amount)).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
