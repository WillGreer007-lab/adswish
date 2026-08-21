"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/ui/google-icon";
import { Loader2 } from "lucide-react";

/**
 * Google OAuth button for login/signup. Reads the `google_oauth_enabled`
 * flag from app_settings (public-read): while disabled it renders blurred as
 * "Coming soon"; once an admin enables it from the Superadmin dashboard the
 * real, clickable button appears for everyone.
 */
export function GoogleAuthButton({
  loading,
  onSignIn,
}: {
  loading: boolean;
  onSignIn: () => void;
}) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "google_oauth_enabled")
          .maybeSingle();
        if (!cancelled) setEnabled(data?.value === "true");
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (enabled) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={onSignIn}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        Continue with Google
      </Button>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-md border border-border">
      <div className="pointer-events-none select-none blur-[3px]" aria-hidden="true">
        <div className="flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground">
          <GoogleIcon className="h-4 w-4" />
          Continue with Google
        </div>
      </div>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Coming soon
      </span>
    </div>
  );
}
