"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Instagram, Youtube, Music2, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { YouTubeHandleVerify } from "@/components/dashboard/youtube-handle-verify";
import { TwitterIcon } from "@/components/ui/oauth-icons";

type SocialAccount = {
  id: string;
  platform: "tiktok" | "instagram" | "youtube" | "twitter";
  handle: string;
  follower_count: number | null;
  verified_at: string | null;
};

const PLATFORMS: { id: "tiktok" | "instagram" | "youtube" | "twitter"; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "tiktok", label: "TikTok", Icon: Music2 },
  { id: "instagram", label: "Instagram", Icon: Instagram },
  { id: "youtube", label: "YouTube", Icon: Youtube },
  { id: "twitter", label: "Twitter/X", Icon: TwitterIcon },
];

export function SocialConnections({ initial }: { initial: SocialAccount[] }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<SocialAccount[]>(initial);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startConnect(platform: "tiktok" | "instagram" | "youtube" | "twitter") {
    setConnecting(platform);
    setError(null);
    // Full-page navigation (provider consent flow) — same pattern as onboarding.
    window.location.assign(`/api/internal/oauth/${platform}?redirect_to=${encodeURIComponent("/dashboard/creator/profile")}`);
  }

  async function disconnect(platform: "tiktok" | "instagram" | "youtube" | "twitter") {
    setDisconnecting(platform);
    setError(null);
    try {
      const res = await fetch("/api/internal/oauth/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Failed to disconnect");
        return;
      }
      setAccounts((prev) => prev.filter((a) => a.platform !== platform));
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setDisconnecting(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {PLATFORMS.map(({ id, label, Icon }) => {
          const connected = accounts.some((a) => a.platform === id);
          if (connected) {
            return (
              <div key={id} className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{label}</span>
                <button
                  type="button"
                  onClick={() => disconnect(id)}
                  disabled={disconnecting === id}
                  className="ml-1 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
                  aria-label={`Disconnect ${label}`}
                >
                  {disconnecting === id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                  Disconnect
                </button>
              </div>
            );
          }
          // TikTok + Twitter/X Connect are disabled — use the token-in-bio +
          // screenshot path instead (no privileged API needed).
          if (id === "tiktok" || id === "twitter") return null;
          if (id === "youtube") {
            // YouTube is self-serve with an ownership proof (challenge code in
            // the channel About) — no OAuth consent screen, no screenshot/admin.
            return (
              <div key={id} className="flex items-center gap-2">
                <YouTubeHandleVerify
                  onVerified={(account) => {
                    setAccounts((prev) => [
                      ...prev.filter((a) => a.platform !== "youtube"),
                      {
                        id: `youtube-${Date.now()}`,
                        platform: "youtube",
                        handle: account.handle,
                        follower_count: account.follower_count,
                        verified_at: new Date().toISOString(),
                      },
                    ]);
                    router.refresh();
                  }}
                />
              </div>
            );
          }
          return (
            <Button
              key={id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => startConnect(id)}
              disabled={connecting !== null}
              className="gap-2"
            >
              {connecting === id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              Connect {label}
            </Button>
          );
        })}
      </div>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No social accounts connected yet. Paste your YouTube handle above to verify instantly,
          connect Instagram, or upload a screenshot for manual verification.
        </p>
      ) : (
        <div className="space-y-2">
          {accounts.map((s) => {
            const meta = PLATFORMS.find((p) => p.id === s.platform);
            const Icon = meta?.Icon ?? Instagram;
            return (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">@{s.handle}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{s.follower_count?.toLocaleString() ?? 0} followers</span>
                  {s.verified_at ? <Badge variant="success">Verified</Badge> : <Badge variant="outline">Pending</Badge>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
