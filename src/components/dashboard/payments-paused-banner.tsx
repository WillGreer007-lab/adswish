"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AlertTriangle } from "lucide-react";

/**
 * Shown on every dashboard page (rendered by DashboardShell) when an admin has
 * paused the account's payments. Reads the user's own profile flag via the
 * browser client, so it works from both server and client dashboard pages.
 */
export function PaymentsPausedBanner({
  role,
  userId,
}: {
  role: "creator" | "business";
  userId: string;
}) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const table = role === "business" ? "business_profiles" : "creator_profiles";
        const { data } = await supabase
          .from(table)
          .select("payouts_paused_at")
          .eq("user_id", userId)
          .maybeSingle();
        if (!cancelled) setPaused(Boolean(data?.payouts_paused_at));
      } catch {
        if (!cancelled) setPaused(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, userId]);

  if (!paused) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
      <div>
        <p className="text-sm font-medium text-warning">Payments are paused on your account</p>
        <p className="text-sm text-muted-foreground">
          An administrator has paused payments on this account, so payouts and
          charges are temporarily on hold. Contact support for details.
        </p>
      </div>
    </div>
  );
}
