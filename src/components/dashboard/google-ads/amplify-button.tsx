"use client";

import { useState } from "react";
import { Rocket } from "lucide-react";
import { GoogleAdsWizard } from "@/components/dashboard/google-ads/wizard";

export function AmplifyButton({ size = "sm" }: { size?: "sm" | "default" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group relative inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
      >
        <Rocket className="h-3.5 w-3.5" />
        Amplify with Google Ads
        {/* Tooltip */}
        <span className="pointer-events-none absolute -top-9 left-1/2 z-10 w-52 -translate-x-1/2 rounded-md bg-foreground px-2.5 py-1.5 text-center text-[11px] font-normal text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          Turn this proven organic post into a paid ad. Zero setup fees.
        </span>
      </button>

      <GoogleAdsWizard open={open} onClose={() => setOpen(false)} />
    </>
  );
}
