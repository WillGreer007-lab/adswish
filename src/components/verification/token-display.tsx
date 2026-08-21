"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SocialPlatform } from "@/lib/verification-token";
import { checkTokenExpiry, formatDuration } from "@/lib/token-rotation";

interface TokenData {
  platform: SocialPlatform;
  handle: string;
  display_code: string;
  expires_at: string;
  status: "pending" | "verifying" | "verified" | "failed" | "expired";
  follower_count: number;
  follower_threshold: number;
}

const PLATFORM_ICONS: Record<SocialPlatform, string> = {
  youtube: "🎬",
  tiktok: "🎵",
  instagram: "📸",
  twitter: "𝕏",
};

const PLATFORM_NAMES: Record<SocialPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  twitter: "Twitter / X",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  verifying: "bg-blue-500/10 text-blue-600",
  verified: "bg-emerald-500/10 text-emerald-600",
  failed: "bg-red-500/10 text-red-600",
  expired: "bg-red-500/10 text-red-600",
};

interface TokenDisplayProps {
  tokens: TokenData[];
  onVerify?: (platform: SocialPlatform) => void;
  onRegenerate?: (platform: SocialPlatform) => void;
}

export function TokenDisplay({ tokens, onVerify, onRegenerate }: TokenDisplayProps) {
  const [copiedPlatform, setCopiedPlatform] = useState<SocialPlatform | null>(null);

  const copyToken = async (platform: SocialPlatform, code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedPlatform(platform);
    setTimeout(() => setCopiedPlatform(null), 1500);
  };

  if (tokens.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Select platforms above to generate tokens.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tokens.map((token) => {
        const expiresSec = Math.floor(new Date(token.expires_at).getTime() / 1000);
        const issuedSec = expiresSec - 7 * 86400;
        const expiry = checkTokenExpiry({
          business_id: "",
          platform: token.platform,
          handle: token.handle,
          issued_at: issuedSec,
          expires_at: expiresSec,
          version: "v1",
        });


        return (
          <div
            key={token.platform}
            className={cn(
              "rounded-xl border p-4 transition-all",
              token.status === "verified"
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-border bg-card",
            )}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">{PLATFORM_ICONS[token.platform]}</span>
              <span className="text-sm font-medium">{PLATFORM_NAMES[token.platform]}</span>
            </div>

            <div className="mb-2 text-xs text-muted-foreground">@{token.handle}</div>

            <div className="mb-3 rounded-md bg-muted/50 p-2 font-mono text-xs break-all">
              {token.display_code}
            </div>

            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={() => copyToken(token.platform, token.display_code)}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                {copiedPlatform === token.platform ? "Copied!" : "Copy"}
              </button>
              {token.status !== "verified" && onVerify && (
                <button
                  onClick={() => onVerify(token.platform)}
                  className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-muted/50"
                >
                  Verify Now
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", STATUS_STYLES[token.status])}>
                {token.status === "verified" ? "✓ Verified" : token.status === "pending" ? "⏳ Pending" : token.status}
              </span>
              <span className="text-xs text-muted-foreground">
                Expires: {formatDuration(expiry.remaining_seconds)}
              </span>
            </div>

            {token.follower_threshold > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                {token.follower_count.toLocaleString()} / {token.follower_threshold.toLocaleString()} followers
                {token.follower_count >= token.follower_threshold ? " ✓" : " ✗"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
