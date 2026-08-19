"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { LogOut, Loader2, AlertTriangle } from "lucide-react";

export function LogoutButton({ variant = "sidebar" }: { variant?: "sidebar" | "topbar" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Ask before leaving/closing the tab while signed in to the dashboard.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  async function handleLogout() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    // Full navigation to /login so every protected route re-checks auth.
    router.push("/login");
    router.refresh();
  }

  const trigger = (
    <button
      onClick={() => setConfirming(true)}
      disabled={loading}
      className={
        variant === "topbar"
          ? "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          : "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      }
      aria-label="Log out"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      {variant === "topbar" ? <span className="hidden sm:inline">Log out</span> : "Log out"}
    </button>
  );

  return (
    <>
      {trigger}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <h2 className="font-heading text-lg font-bold">You&apos;re leaving Adswish</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              You&apos;re about to log out and leave the dashboard. You&apos;ll need to sign back in to continue.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Back
              </button>
              <button
                onClick={handleLogout}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
