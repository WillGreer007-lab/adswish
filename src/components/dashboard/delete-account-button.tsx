"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { resetAppearance } from "@/lib/appearance";

export function DeleteAccountButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (confirmText.trim().toLowerCase() !== "delete") return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/account/delete", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(
          Array.isArray(json.blockers) && json.blockers.length
            ? json.blockers.join(" ")
            : json.error || "Could not delete your account.",
        );
        setLoading(false);
        setConfirming(false);
        setConfirmText("");
        return;
      }
      resetAppearance();
      router.push("/login?deleted=1");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-destructive/40 bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-base font-semibold text-destructive">
            Danger zone
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently delete your account and personal data. Reviews you left are
            anonymised (rating + date retained); everything else is removed. This
            cannot be undone.
          </p>
        </div>
        {!confirming ? (
          <button
            onClick={() => {
              setConfirming(true);
              setError(null);
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-destructive/60 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="h-4 w-4" />
            Delete account
          </button>
        ) : (
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex w-64 items-center gap-2">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-destructive"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setConfirming(false);
                  setConfirmText("");
                  setError(null);
                }}
                disabled={loading}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading || confirmText.trim().toLowerCase() !== "delete"}
                className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                {loading ? "Deleting…" : "Confirm delete"}
              </button>
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
