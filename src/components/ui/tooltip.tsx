"use client";

/**
 * Lightweight CSS hover tooltip — dark box that pops up ABOVE the wrapped
 * element on hover (v3 hover-tooltip pattern). No portal, no dependencies.
 */
export function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
}) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 ${
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
        }`}
      >
        {label}
      </span>
    </span>
  );
}
