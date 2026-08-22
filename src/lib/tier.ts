export type Tier = "micro" | "mid" | "macro";

export function getCreatorTier(
  followerCount: number,
): Tier | null {
  if (followerCount < 10000) return null;
  if (followerCount < 100000) return "micro";
  if (followerCount < 1000000) return "mid";
  return "macro";
}

/**
 * Display metadata for the three creator tiers.
 * Kept as a single source of truth so the badge label + colour are
 * consistent across the landing page, marketplace, onboarding and dashboards.
 */
export const TIER_META: Record<Tier, { label: string; short: string; color: string }> = {
  micro: {
    label: "Small Creator",
    short: "Small",
    color: "bg-emerald-500/10 text-emerald-700",
  },
  mid: {
    label: "Moderate Creator",
    short: "Moderate",
    color: "bg-blue-500/10 text-blue-700",
  },
  macro: {
    label: "Big Creator",
    short: "Big",
    color: "bg-violet-500/10 text-violet-700",
  },
};

export function tierLabel(tier: string): string {
  return TIER_META[tier as Tier]?.label ?? tier;
}

export function tierColor(tier: string): string {
  return TIER_META[tier as Tier]?.color ?? "bg-muted text-muted-foreground";
}

export const TIER_LIMITS = {
  micro: {
    campaignTypes: ["fixed"],
    maxActiveCampaigns: 2,
  },
  mid: {
    campaignTypes: ["fixed", "hybrid"],
    maxActiveCampaigns: 5,
  },
  macro: {
    campaignTypes: ["fixed", "affiliate", "hybrid"],
    maxActiveCampaigns: Infinity,
  },
} as const;

export function canApplyToCampaignType(
  tier: Tier,
  campaignType: "fixed" | "affiliate" | "hybrid",
): boolean {
  return TIER_LIMITS[tier].campaignTypes.includes(campaignType as any);
}

export function getMaxActiveCampaigns(
  tier: Tier,
): number {
  return TIER_LIMITS[tier].maxActiveCampaigns;
}
