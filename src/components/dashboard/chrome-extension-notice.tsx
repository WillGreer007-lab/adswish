"use client";

import { useSyncExternalStore } from "react";
import { AlertTriangle } from "lucide-react";

function detectChrome(): boolean {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent;
  return /Chrome\//i.test(ua) && !/Edg\/|OPR\/|Brave|Vivaldi|SamsungBrowser/i.test(ua);
}

const noopSubscribe = () => () => {};

/**
 * Shows a warning when the visitor isn't on Google Chrome, since the
 * Adswish Tracker extension only installs in Chrome.
 */
export function ChromeExtensionNotice() {
  const isChrome = useSyncExternalStore(noopSubscribe, detectChrome, () => true);

  if (isChrome) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
      <div className="text-sm">
        <p className="font-medium text-warning-foreground">You&apos;re not on Chrome</p>
        <p className="text-muted-foreground">
          The Adswish Tracker extension only works in Google Chrome.{" "}
          <a
            href="https://www.google.com/chrome/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Continue on Chrome
          </a>{" "}
          to use extension tracking — or keep using the pixel script instead.
        </p>
      </div>
    </div>
  );
}
