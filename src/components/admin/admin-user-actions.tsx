"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type Action =
  | "suspend"
  | "activate"
  | "ban"
  | "strike"
  | "cancel_plan"
  | "resume_plan"
  | "terminate"
  | "pause_payments"
  | "resume_payments";

export function AdminUserActions({
  userId,
  role,
  status,
  planStatus = null,
  payoutsPaused = false,
  disabled = false,
}: {
  userId: string;
  role: "creator" | "business";
  status: string;
  planStatus?: string | null;
  payoutsPaused?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    const labels: Record<Action, string> = {
      suspend: "suspend",
      activate: "reactivate",
      ban: "ban",
      strike: "add a strike to",
      cancel_plan: "cancel the plan for",
      resume_plan: "resume the plan for",
      terminate: "permanently terminate",
      pause_payments: "pause payments for",
      resume_payments: "resume payments for",
    };
    if (!window.confirm(`Are you sure you want to ${labels[action]} this ${role} account?`)) return;

    // Cancel-plan / terminate end billing, resume-plan restarts it: ask
    // explicitly before touching the live Stripe subscription (real money).
    let cancelStripe = false;
    let resumeStripe = false;
    if (action === "cancel_plan" || action === "terminate") {
      cancelStripe = window.confirm(
        action === "cancel_plan"
          ? "Also cancel the underlying Stripe subscription so the customer is not billed again?"
          : "Also cancel the underlying Stripe subscription as part of this termination?",
      );
    } else if (action === "resume_plan") {
      resumeStripe = window.confirm(
        "Also reactivate the underlying Stripe subscription (only works if it was canceled at period end)?",
      );
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/internal/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role, action, cancel_stripe: cancelStripe, resume_stripe: resumeStripe }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Admin action failed");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Admin action failed");
    } finally {
      setLoading(false);
    }
  }

  if (disabled) return <span className="text-xs text-background/40">Current admin</span>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-background/60" />
      ) : (
        <>
          {/* Account lifecycle */}
          {status === "active" || status === "pending" ? (
            <>
              <button type="button" onClick={() => run("suspend")} className="rounded border border-warning/40 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/10">
                Suspend
              </button>
              <button type="button" onClick={() => run("ban")} className="rounded border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10">
                Ban
              </button>
              <button type="button" onClick={() => run("strike")} className="rounded border border-warning/40 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/10">
                Strike
              </button>
            </>
          ) : status === "suspended" ? (
            <>
              <button type="button" onClick={() => run("activate")} className="rounded border border-success/40 px-2 py-1 text-xs font-medium text-success hover:bg-success/10">
                Reactivate
              </button>
              <button type="button" onClick={() => run("ban")} className="rounded border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10">
                Ban
              </button>
              <button type="button" onClick={() => run("strike")} className="rounded border border-warning/40 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/10">
                Strike
              </button>
            </>
          ) : (
            <button type="button" onClick={() => run("activate")} className="rounded border border-success/40 px-2 py-1 text-xs font-medium text-success hover:bg-success/10">
              Unban
            </button>
          )}

          {/* Billing / payments */}
          {planStatus === "canceled" ? (
            <button type="button" onClick={() => run("resume_plan")} className="rounded border border-success/40 px-2 py-1 text-xs font-medium text-success hover:bg-success/10">
              Resume plan
            </button>
          ) : planStatus ? (
            <button type="button" onClick={() => run("cancel_plan")} className="rounded border border-warning/40 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/10">
              Cancel plan
            </button>
          ) : null}
          {payoutsPaused ? (
            <button type="button" onClick={() => run("resume_payments")} className="rounded border border-success/40 px-2 py-1 text-xs font-medium text-success hover:bg-success/10">
              Resume payments
            </button>
          ) : (
            <button type="button" onClick={() => run("pause_payments")} className="rounded border border-warning/40 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/10">
              Pause payments
            </button>
          )}

          {/* Terminate */}
          <button type="button" onClick={() => run("terminate")} className="rounded border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10">
            Terminate
          </button>
        </>
      )}
      {error && <span className="basis-full text-xs text-destructive">{error}</span>}
    </div>
  );
}
