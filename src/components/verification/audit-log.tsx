"use client";

export interface AuditEntry {
  ok: boolean;
  warn?: boolean;
  text: string;
}

export function AuditLog({
  entries,
  overallScore,
  status,
}: {
  entries: AuditEntry[];
  overallScore: number | null;
  status: string | null;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg bg-muted/30 p-4 font-mono text-xs text-muted-foreground">
        <span className="text-amber-600">⚠</span> No audit run yet. Complete verification to generate
        audit.
      </div>
    );
  }

  return (
    <div className="max-h-56 overflow-y-auto rounded-lg bg-muted/30 p-4 font-mono text-xs leading-6 text-muted-foreground">
      {entries.map((entry, i) => (
        <div key={i}>
          <span className={entry.warn ? "text-amber-600" : entry.ok ? "text-emerald-600" : "text-red-600"}>
            {entry.ok ? "✓" : entry.warn ? "⚠" : "✗"}
          </span>{" "}
          {entry.text}
        </div>
      ))}
      {overallScore !== null && status && (
        <div className="mt-2 border-t border-border pt-2">
          <strong className="text-foreground">Status:</strong>{" "}
          <span className={status === "verified" ? "text-emerald-600" : status === "pending_review" ? "text-amber-600" : "text-red-600"}>
            {status === "verified" ? "VERIFIED" : status === "pending_review" ? "UNDER REVIEW" : "FAILED"} — Score {overallScore}/100
          </span>
        </div>
      )}
    </div>
  );
}
