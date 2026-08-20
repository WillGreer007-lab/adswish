"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { readSessionTimeout, timeoutToMs } from "@/lib/session-timeout";
import { AlertTriangle, Clock } from "lucide-react";

const WARNING_MS = 30_000;

export function SessionTimeoutGuard() {
  const router = useRouter();
  const [warning, setWarning] = useState(false);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetRef = useRef<() => void>(() => {});

  useEffect(() => {
    const timeoutMs = timeoutToMs(readSessionTimeout());
    if (timeoutMs === null) return; // "Never" — no inactivity timeout
    const ms = timeoutMs; // narrowed to number for the closures below

    async function logout() {
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
      } catch {
        /* continue to redirect even if signOut fails */
      }
      router.push("/login?timeout=1");
      router.refresh();
    }

    function reset() {
      setWarning(false);
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);

      const warnAt = Math.max(0, ms - WARNING_MS);
      warningTimer.current = setTimeout(() => setWarning(true), warnAt);
      logoutTimer.current = setTimeout(logout, ms);
    }

    resetRef.current = reset;

    const events: (keyof WindowEventMap)[] = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
    };
  }, [router]);

  if (!warning) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-lg border border-warning/40 bg-surface p-4 shadow-xl">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-warning/10">
        <AlertTriangle className="h-4 w-4 text-warning" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Session timing out soon</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> You&apos;ll be logged out in 30 seconds due to inactivity.
        </p>
      </div>
      <button
        onClick={() => resetRef.current()}
        className="flex-shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        Keep me signed in
      </button>
    </div>
  );
}
