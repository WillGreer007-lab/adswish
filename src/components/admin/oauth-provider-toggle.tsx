"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { GoogleIcon } from "@/components/ui/google-icon";

/**
 * Superadmin control for the Google OAuth sign-in button. Reads the
 * app_settings flag via the admin API and toggles it. The public login/signup
 * button only goes live when this is enabled — flip it after the Google Cloud
 * OAuth redirect URI has been registered.
 */
export function OAuthProviderToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/internal/admin/oauth-provider")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not ok"))))
      .then((j) => setEnabled(j.enabled === true))
      .catch(() => setError("Could not load status"))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/admin/oauth-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google", enabled: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not update");
      } else {
        setEnabled(json.enabled === true);
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-background/10 bg-surface/5 p-4">
      <div className="flex items-center gap-3">
        <GoogleIcon className="h-6 w-6" />
        <div>
          <p className="text-sm font-medium text-background">Google sign-in</p>
          <p className="text-xs text-background/60">
            {enabled ? "Live on login and sign-up" : "Blurred as “Coming soon”"}
          </p>
        </div>
      </div>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-background/40" />
      ) : busy ? (
        <Loader2 className="h-4 w-4 animate-spin text-background/40" />
      ) : enabled ? (
        <button
          type="button"
          onClick={() => toggle(false)}
          className="rounded border border-warning/40 px-3 py-1.5 text-xs font-medium text-warning hover:bg-warning/10"
        >
          Disable
        </button>
      ) : (
        <button
          type="button"
          onClick={() => toggle(true)}
          className="rounded border border-success/40 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/10"
        >
          Enable
        </button>
      )}

      {error && <span className="basis-full text-xs text-destructive">{error}</span>}
    </div>
  );
}
