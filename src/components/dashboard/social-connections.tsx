"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Instagram, Youtube, Music2, Unlink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TwitterIcon } from "@/components/ui/oauth-icons";

export type SocialAccount = {
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

/**
 * The connected-accounts list + disconnect control. Connection itself happens
 * through the verification method picker (automation setup or manual sign up),
 * so this component only shows what is already connected.
 */
export function SocialConnections({ initial }: { initial: SocialAccount[] }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<SocialAccount[]>(initial);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No social accounts connected yet. Pick a method above — automation setup or manual sign
          up — to connect your first platform.
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
                  <button
                    type="button"
                    onClick={() => disconnect(s.platform)}
                    disabled={disconnecting === s.platform}
                    className="ml-1 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
                    aria-label={`Disconnect ${s.platform}`}
                  >
                    {disconnecting === s.platform ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                    Disconnect
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
