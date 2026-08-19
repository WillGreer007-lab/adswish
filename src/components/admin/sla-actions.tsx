"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function SlaActions({ disputeId, canSettle }: { disputeId: string; canSettle: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "dismiss" | "force_release" | "refund_business") {
    const labels = {
      dismiss: "dismiss this dispute",
      force_release: "force-release the linked creator payout",
      refund_business: "refund the linked business",
    };
    if (!window.confirm(`Are you sure you want to ${labels[action]}? This action is audit logged.`)) return;

    setBusy(action);
    setError(null);
    try {
      const response = await fetch("/api/internal/admin/sla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dispute_id: disputeId, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "SLA action failed");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "SLA action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {busy ? <Loader2 className="h-4 w-4 animate-spin text-background/60" /> : (
        <>
          {canSettle && (
            <>
              <button type="button" onClick={() => run("force_release")} className="rounded border border-success/40 px-2 py-1 text-xs font-medium text-success hover:bg-success/10">
                Force release
              </button>
              <button type="button" onClick={() => run("refund_business")} className="rounded border border-warning/40 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/10">
                Refund business
              </button>
            </>
          )}
          <button type="button" onClick={() => run("dismiss")} className="rounded border border-background/20 px-2 py-1 text-xs font-medium text-background/70 hover:bg-background/10">
            Dismiss
          </button>
        </>
      )}
      {error && <span className="basis-full text-xs text-destructive">{error}</span>}
    </div>
  );
}
