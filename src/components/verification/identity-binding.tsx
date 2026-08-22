"use client";

interface ProofCard {
  name: string;
  points: number;
  optional?: boolean;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function IdentityBinding({
  confidence,
  minimumMet,
  proofs,
}: {
  confidence: number | null;
  minimumMet: boolean;
  proofs: ProofCard[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        These proofs prevent impersonation. They verify the human creating this campaign is the
        actual account owner.
      </p>

      {proofs.map((proof, i) => (
        <div key={i} className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium">
              {i + 1}. {proof.name}
            </span>
            <span
              className={
                proof.optional
                  ? "rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600"
                  : "rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600"
              }
            >
              +{proof.points} pts{proof.optional ? " (optional)" : ""}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{proof.description}</p>
          {proof.actionLabel && proof.onAction && (
            <button
              type="button"
              onClick={proof.onAction}
              className="mt-2 rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-muted/50"
            >
              {proof.actionLabel}
            </button>
          )}
        </div>
      ))}

      {confidence !== null && (
        <div
          className={
            minimumMet
              ? "rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3"
              : "rounded-lg border border-border bg-card p-3"
          }
        >
          <div className="text-sm font-medium">
            Identity Confidence: {confidence}/100
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {minimumMet ? "Minimum requirements met. Identity verified." : "Minimum requirements not yet met."}
          </div>
        </div>
      )}
    </div>
  );
}
