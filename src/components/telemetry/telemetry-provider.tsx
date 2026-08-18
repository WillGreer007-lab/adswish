"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  installErrorListeners,
  setTelemetryUserId,
  trackPageView,
} from "@/lib/telemetry";

/**
 * Mounts the first-party telemetry (page views + crash reporting) once for the
 * whole app. Fails silently — analytics/error capture must never block or
 * break rendering.
 */
export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const installed = useRef(false);

  useEffect(() => {
    if (installed.current) return;
    installed.current = true;

    installErrorListeners();

    // Best-effort attribution of events to the signed-in user. Never awaited —
    // page views fall back to anonymous if the session lookup is slow.
    createSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => setTelemetryUserId(data.user?.id ?? null))
      .catch(() => setTelemetryUserId(null));
  }, []);

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  return <>{children}</>;
}
