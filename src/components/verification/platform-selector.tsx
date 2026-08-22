"use client";

import { cn } from "@/lib/utils";
import { PLATFORM_THRESHOLDS, type SocialPlatform } from "@/lib/socialverify/tokens";

const PLATFORM_INFO: Record<SocialPlatform, { name: string; icon: string }> = {
  youtube: { name: "YouTube", icon: "🎬" },
  tiktok: { name: "TikTok", icon: "🎵" },
  instagram: { name: "Instagram", icon: "📸" },
  twitter: { name: "Twitter / X", icon: "𝕏" },
};

const PLATFORMS: SocialPlatform[] = ["youtube", "tiktok", "instagram", "twitter"];

export function PlatformSelector({
  selected,
  onChange,
  disabled,
}: {
  selected: SocialPlatform[];
  onChange: (platforms: SocialPlatform[]) => void;
  disabled?: boolean;
}) {
  const toggle = (platform: SocialPlatform) => {
    if (disabled) return;
    onChange(
      selected.includes(platform)
        ? selected.filter((p) => p !== platform)
        : [...selected, platform],
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Check any combination. Each must be individually verified and meet minimum followers.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PLATFORMS.map((pf) => {
          const info = PLATFORM_INFO[pf];
          const isSelected = selected.includes(pf);
          return (
            <button
              key={pf}
              type="button"
              onClick={() => toggle(pf)}
              disabled={disabled}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span className="text-lg" aria-hidden>
                {info.icon}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium">{info.name}</span>
                <span className="block text-xs text-muted-foreground">
                  min {PLATFORM_THRESHOLDS[pf].toLocaleString()} followers
                </span>
              </span>
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded border-2",
                  isSelected ? "border-primary bg-primary" : "border-muted-foreground",
                )}
              >
                {isSelected && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="h-3 w-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
