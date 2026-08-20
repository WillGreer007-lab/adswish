"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { applyAppearance, readAppearance, DEFAULTS } from "@/lib/appearance";

/**
 * Applies the user's saved appearance only inside the dashboard.
 * Public pages (landing, login, signup, guides, marketplace) always use the
 * default light theme so customisation never leaks out of the signed-in area.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/account-suspended");

  useEffect(() => {
    applyAppearance(isDashboard ? readAppearance() : DEFAULTS);
  }, [isDashboard]);

  return <>{children}</>;
}
