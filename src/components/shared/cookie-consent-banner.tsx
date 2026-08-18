"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const CONSENT_KEY = "adswish_cookie_consent";
const CONSENT_VERSION = "1.0";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      const timer = setTimeout(() => setVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, []);

  async function handleConsent(granted: boolean) {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ granted, version: CONSENT_VERSION, timestamp: Date.now() }),
    );

    try {
      const { createSupabaseBrowserClient } = await import("@/lib/supabase/browser");
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const response = await fetch("/api/internal/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consent_type: "cookie",
            granted,
            consent_version: CONSENT_VERSION,
          }),
        });
        if (!response.ok) {
          console.error("Failed to log consent");
        }
      }
    } catch {
    }

    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface p-4 shadow-lg">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <Cookie className="hidden h-5 w-5 flex-shrink-0 text-primary sm:block" />
          <p className="text-sm text-muted-foreground">
            We use cookies to track attribution and improve your experience.
            By clicking &quot;Accept&quot;, you consent to our use of cookies.
            See our{" "}
            <a href="/legal/privacy" className="font-medium text-primary hover:underline">
              Privacy Policy
            </a>{" "}
            for details.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleConsent(false)}>
            Decline
          </Button>
          <Button size="sm" onClick={() => handleConsent(true)}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
