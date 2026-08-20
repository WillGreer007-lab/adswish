"use client";

import { Info } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

/**
 * Spec §21 hover tooltips: a small ℹ️ icon next to a feature label; hovering
 * shows a dark tooltip with white text above it, which disappears on leave.
 */
export function InfoTooltip({ label }: { label: string }) {
  return (
    <Tooltip label={label}>
      <span className="inline-flex cursor-help items-center text-muted-foreground/70 transition-colors hover:text-muted-foreground">
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </span>
    </Tooltip>
  );
}

/** Section header with the ℹ️ tooltip built in (e.g. "Reviews ℹ️"). */
export function SectionLabel({
  title,
  hint,
  count,
}: {
  title: string;
  hint: string;
  count?: number;
}) {
  return (
    <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
      {title}
      {typeof count === "number" && <span className="text-muted-foreground">({count})</span>}
      <InfoTooltip label={hint} />
    </h2>
  );
}
