"use client";

import { Zap, PenLine, CheckCircle2, Clock3, XCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { type MethodStatus, type VerificationMethod } from "@/lib/verification-methods";

const STATUS_META: Record<MethodStatus, { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }> = {
  not_started: { label: "Not started", className: "bg-muted text-muted-foreground", Icon: PenLine },
  requires_review: { label: "Requires review", className: "bg-warning/15 text-warning", Icon: Clock3 },
  completed: { label: "Completed", className: "bg-success/15 text-success", Icon: CheckCircle2 },
  failed: { label: "Failed", className: "bg-destructive/15 text-destructive", Icon: XCircle },
};

function StatusBadge({ status }: { status: MethodStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.Icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", meta.className)}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

/**
 * The two-box method chooser shown at the top of onboarding Step 2 and in the
 * dashboard "Connected accounts" settings. Picking a method routes the creator
 * into that method's own steps.
 */
export function VerificationMethodPicker({
  automationStatus,
  manualStatus,
  selected,
  onSelect,
}: {
  automationStatus: MethodStatus;
  manualStatus: MethodStatus;
  selected: VerificationMethod | null;
  onSelect: (method: VerificationMethod) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">How do you want to verify your audience?</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a method. You can switch or add the other one any time from Settings.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Automation setup (main method) */}
        <button
          type="button"
          onClick={() => onSelect("automation")}
          className={cn(
            "flex flex-col gap-3 rounded-lg border-2 p-4 text-left transition-colors",
            selected === "automation"
              ? "border-primary bg-primary/5"
              : "border-border bg-surface hover:border-primary/40",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Zap className="h-5 w-5" />
            </span>
            <StatusBadge status={automationStatus} />
          </div>
          <div>
            <p className="text-sm font-semibold">Automation setup</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Connect your account with OAuth / an API key. Your follower count is pulled live and
              verified instantly — no screenshot, no waiting for admin review.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            {automationStatus === "completed" ? "Manage connections" : "Start setup"}
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>

        {/* Manual sign up (option 2) */}
        <button
          type="button"
          onClick={() => onSelect("manual")}
          className={cn(
            "flex flex-col gap-3 rounded-lg border-2 p-4 text-left transition-colors",
            selected === "manual"
              ? "border-primary bg-primary/5"
              : "border-border bg-surface hover:border-primary/40",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <PenLine className="h-5 w-5" />
            </span>
            <StatusBadge status={manualStatus} />
          </div>
          <div>
            <p className="text-sm font-semibold">Manual sign up</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Post your unique code in your bio, upload a screenshot, and our team reviews it.
              Works for every platform, no API keys needed.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            {manualStatus === "requires_review" ? "Check review status" : "Start manual sign up"}
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>
      </div>
    </div>
  );
}
