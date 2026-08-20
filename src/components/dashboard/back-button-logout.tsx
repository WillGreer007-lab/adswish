"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { resetAppearance } from "@/lib/appearance";

/**
 * Auto-logout on the browser back/forward button (v3 session security).
 *
 * `popstate` fires only when the user traverses history (back/forward buttons),
 * never for in-app `<Link>` navigation or `router.push`, so clicking around
 * inside the dashboard is unaffected. When history traversal lands OUTSIDE the
 * dashboard (landing page, login, another site's tab), the session is ended
 * and the user is sent to /login?timeout=1 with the "session has timed out"
 * message.
 */
export function BackButtonLogout() {
  const router = useRouter();

  useEffect(() => {
    let signingOut = false;

    async function onPopState() {
      const path = window.location.pathname;
      if (path.startsWith("/dashboard")) return; // still inside the dashboard
      if (signingOut) return;
      signingOut = true;
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        resetAppearance();
      } catch {
        /* redirect regardless */
      }
      router.replace("/login?timeout=1");
      router.refresh();
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);

  return null;
}
