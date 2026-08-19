"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function AdminUserActions({
  userId,
  role,
  status,
  disabled = false,
}: {
  userId: string;
  role: "creator" | "business";
  status: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "suspend" | "activate" | "ban") {
    const label = action === "suspend" ? "suspend" : action === "ban" ? "ban" : "reactivate";
    if (!window.confirm(`Are you sure you want to ${label} this ${role} account?`)) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/internal/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role, action }),
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
      ) : status === "active" || status === "pending" ? (
        <>
          <button type="button" onClick={() => run("suspend")} className="rounded border border-warning/40 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/10">
            Suspend
          </button>
          <button type="button" onClick={() => run("ban")} className="rounded border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10">
            Ban
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
        </>
      ) : (
        <button type="button" onClick={() => run("activate")} className="rounded border border-success/40 px-2 py-1 text-xs font-medium text-success hover:bg-success/10">
          Unban
        </button>
      )}
      {error && <span className="basis-full text-xs text-destructive">{error}</span>}
    </div>
  );
}
