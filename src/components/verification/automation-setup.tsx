"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Instagram, Music2, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { YouTubeHandleVerify } from "@/components/dashboard/youtube-handle-verify";
import { cn } from "@/lib/utils";

type Providers = { instagram: boolean; tiktok: boolean; youtube: boolean };

/**
 * The "Automation setup" method panel. Lists each automatable platform:
 *  - Instagram → OAuth (redirects out, the callback upserts + verifies).
 *  - TikTok    → OAuth (same).
 *  - YouTube   → self-serve API-key verification with a challenge code.
 * A platform whose credentials aren't configured shows "Not configured" instead
 * of a dead-end redirect, and the creator is pointed at manual verification.
 */
export function AutomationSetup({
  redirectTo = "/onboarding/creator/connect_social",
  onConnected,
}: {
  redirectTo?: string;
  onConnected?: () => void;
}) {
  const router = useRouter();
  const [providers, setProviders] = useState<Providers | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch("/api/internal/oauth/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (mounted && j?.automation) setProviders(j.automation);
        if (mounted) setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  function connectHref(platform: "instagram" | "tiktok") {
    return `/api/internal/oauth/${platform}?redirect_to=${encodeURIComponent(redirectTo)}`;
  }

  const buttonClass =
    "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90";

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">Connect automatically</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Connect once and we keep your follower count fresh automatically. No screenshots, no
          admin review.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking which platforms are available…
        </div>
      )}

      <div className="space-y-2">
        {/* Instagram */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <Instagram className="h-4 w-4 text-pink-600" />
            <div>
              <p className="text-sm font-medium">Instagram</p>
              <p className="text-xs text-muted-foreground">OAuth connect · auto-verified</p>
            </div>
          </div>
          {providers?.instagram ? (
            <a href={connectHref("instagram")} className={cn(buttonClass, "text-xs")}>
              Connect with Instagram
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" /> Not configured — use manual below
            </span>
          )}
        </div>

        {/* TikTok */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <Music2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">TikTok</p>
              <p className="text-xs text-muted-foreground">OAuth connect · auto-verified</p>
            </div>
          </div>
          {providers?.tiktok ? (
            <a href={connectHref("tiktok")} className={cn(buttonClass, "text-xs")}>
              Connect with TikTok
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" /> Not configured — use manual below
            </span>
          )}
        </div>

        {/* YouTube (self-serve) */}
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <div>
              <p className="text-sm font-medium">YouTube</p>
              <p className="text-xs text-muted-foreground">
                Paste your handle, add a one-time code to your channel About, and verify — no OAuth,
                no screenshot.
              </p>
            </div>
          </div>
          <div className="mt-3">
            <YouTubeHandleVerify
              onVerified={(account) => {
                onConnected?.();
                router.refresh();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
