"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SocialPlatform } from "@/lib/verification-token";
import { PLATFORM_THRESHOLDS } from "@/lib/verification-token";

const PLATFORM_INFO: Record<SocialPlatform, { name: string; icon: string; color: string }> = {
  youtube: { name: "YouTube", icon: "🎬", color: "bg-red-500/10 text-red-600" },
  tiktok: { name: "TikTok", icon: "🎵", color: "bg-white/10 text-foreground" },
  instagram: { name: "Instagram", icon: "📸", color: "bg-pink-500/10 text-pink-600" },
  twitter: { name: "Twitter / X", icon: "𝕏", color: "bg-white/10 text-foreground" },
};

interface PlatformSelectorProps {
  selected: SocialPlatform[];
  onChange: (platforms: SocialPlatform[]) => void;
  disabled?: boolean;
}

export function PlatformSelector({ selected, onChange, disabled }: PlatformSelectorProps) {
  const platforms: SocialPlatform[] = ["youtube", "tiktok", "instagram", "twitter"];

  const toggle = (platform: SocialPlatform) => {
    if (disabled) return;
    if (selected.includes(platform)) {
      onChange(selected.filter((p) => p !== platform));
    } else {
      onChange([...selected, platform]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        Check any combination. Each must be individually verified and meet minimum followers.
      </div>
      <div className="grid grid-cols-2 gap-3">
        {platforms.map((pf) => {
          const info = PLATFORM_INFO[pf];
          const isSelected = selected.includes(pf);
          return (
            <button
              key={pf}
              onClick={() => toggle(pf)}
              disabled={disabled}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <span className="text-lg">{info.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium">{info.name}</div>
                <div className="text-xs text-muted-foreground">
                  min {PLATFORM_THRESHOLDS[pf].toLocaleString()} followers
                </div>
              </div>
              <div
                className={cn(
                  "h-4 w-4 rounded border-2 transition-all",
                  isSelected ? "border-primary bg-primary" : "border-muted-foreground",
                )}
              >
                {isSelected && (
                  <svg className="h-full w-full text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
