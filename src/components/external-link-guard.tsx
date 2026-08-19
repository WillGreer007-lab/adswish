"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

type Pending = { href: string; target: string };

export function ExternalLinkGuard() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      // Ignore modified clicks (new tab, etc.) and non-left clicks.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href") ?? "";
      let url: URL | null = null;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }

      // Only guard genuine off-site navigations (http/https to another host).
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      if (url.hostname === window.location.hostname) return;

      e.preventDefault();
      setPending({ href: url.href, target: anchor.target || "_self" });
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  function proceed() {
    if (!pending) return;
    const { href, target } = pending;
    setPending(null);
    if (target === "_blank") {
      window.open(href, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = href;
    }
  }

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-xl">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-warning/10">
          <AlertTriangle className="h-5 w-5 text-warning" />
        </div>
        <h2 className="font-heading text-lg font-bold">You&apos;re leaving Adswish</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This link opens an external website we don&apos;t control:
          <span className="mt-1 block break-all font-mono text-xs text-foreground/80">{pending.href}</span>
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => setPending(null)}
            className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Back
          </button>
          <button
            onClick={proceed}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
