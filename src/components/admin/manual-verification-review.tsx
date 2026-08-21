"use client";

import { useState } from "react";
import { Check, Clock3, Loader2, X } from "lucide-react";

export type ManualVerificationReviewRow = {
  id: string;
  creator_id: string;
  platform: "tiktok" | "instagram" | "youtube" | "twitter";
  handle: string | null;
  claimed_follower_count: number | null;
  verification_token: string | null;
  screenshot_url: string | null;
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  created_at: string;
  creator_profiles: { display_name: string; profile_picture_url: string | null } | null;
};

export function ManualVerificationReview({ initial }: { initial: ManualVerificationReviewRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function review(id: string, status: "approved" | "rejected") {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch("/api/internal/admin/manual-verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, review_notes: notes[id] || null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Review action failed");
      setRows((current) => current.map((row) => row.id === id ? { ...row, status, review_notes: notes[id] || null } : row));
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Review action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {rows.length === 0 && <p className="rounded-lg border border-dashed border-background/20 p-8 text-center text-sm text-background/60">No manual follower submissions are waiting for review.</p>}
      {rows.map((row) => (
        <article key={row.id} className="grid gap-4 rounded-lg border border-background/10 bg-surface/5 p-4 lg:grid-cols-[180px_1fr_auto]">
          <div className="overflow-hidden rounded-md border border-background/10 bg-background/10">
            {row.screenshot_url ? (
              // Signed URL is short-lived and only returned to admins.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.screenshot_url} alt={`${row.platform} follower proof for ${row.handle || "creator"}`} className="h-48 w-full object-contain" />
            ) : (
              <div className="flex h-48 items-center justify-center text-xs text-background/50">Screenshot unavailable</div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-lg font-semibold text-background">{row.creator_profiles?.display_name || "Creator"}</h2>
              <span className="rounded-full bg-background/10 px-2 py-0.5 text-xs capitalize text-background/70">{row.platform}</span>
              <span className="flex items-center gap-1 text-xs text-warning"><Clock3 className="h-3.5 w-3.5" /> {row.status}</span>
            </div>
            <p className="text-sm text-background/70">@{row.handle || "—"} · <strong className="text-background">{Number(row.claimed_follower_count ?? 0).toLocaleString()}</strong> claimed followers</p>
            {row.verification_token && (
              <p className="text-xs text-background/70">
                Expected bio token: <code className="rounded bg-background/10 px-1.5 py-0.5 font-mono text-xs font-semibold">{row.verification_token}</code>
              </p>
            )}
            <p className="text-xs text-background/50">Submitted {new Date(row.created_at).toLocaleString()}</p>
            <textarea
              value={notes[row.id] ?? row.review_notes ?? ""}
              onChange={(e) => setNotes((current) => ({ ...current, [row.id]: e.target.value }))}
              placeholder="Optional review note"
              rows={2}
              className="w-full rounded-md border border-background/15 bg-background/5 px-3 py-2 text-sm text-background placeholder:text-background/40 focus:outline-none focus:ring-1 focus:ring-background/30"
            />
          </div>
          <div className="flex items-start gap-2 lg:flex-col">
            <button type="button" disabled={busy === row.id || row.status === "approved"} onClick={() => review(row.id, "approved")} className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
              {busy === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
            </button>
            <button type="button" disabled={busy === row.id || row.status === "rejected"} onClick={() => review(row.id, "rejected")} className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive disabled:opacity-50">
              <X className="h-4 w-4" /> Reject
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
