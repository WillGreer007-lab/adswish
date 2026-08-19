"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Site-wide floating "Back" button shown on every page. Calls router.back();
 * on a fresh tab with no history this is a harmless no-op.
 */
export function GlobalBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Go back"
      className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/95 px-3.5 py-2 text-sm font-medium text-muted-foreground shadow-lg backdrop-blur transition-colors hover:bg-muted hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </button>
  );
}
