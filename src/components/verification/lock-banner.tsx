"use client";

import type { SocialPlatform } from "@/lib/socialverify/tokens";

const PLATFORM_NAMES: Record<SocialPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  twitter: "Twitter / X",
};

export function LockBanner({
  locked,
  unverified,
  selectedCount,
}: {
  locked: boolean;
  unverified: SocialPlatform[];
  selectedCount: number;
}) {
  if (selectedCount === 0) return null;

  if (!locked) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
        <span className="text-lg" aria-hidden>🔓</span>
        <span className="text-sm">
          <strong className="text-emerald-600">Campaign unlocked!</strong> All selected platforms
          verified. Submit for final audit.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
      <span className="text-lg" aria-hidden>🔒</span>
      <span className="text-sm">
        <strong className="text-red-600">Campaign locked.</strong> {unverified.length} pending:{" "}
        {unverified.map((p) => PLATFORM_NAMES[p]).join(", ")}
      </span>
    </div>
  );
}
