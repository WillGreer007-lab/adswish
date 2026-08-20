"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Site-wide floating "Back" button. Only shown when there is actually a
 * previous page to go back to (fresh tabs / direct visits have nothing), and
 * never on the landing page or inside the dashboard (which has its own back
 * button in the top bar).
 */
export function GlobalBackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const update = () => setCanGoBack(window.history.length > 1);
    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, [pathname]);

  if (pathname === "/" || pathname.startsWith("/dashboard") || !canGoBack) {
    return null;
  }

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
