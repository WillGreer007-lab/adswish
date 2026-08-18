export function getCreatorTier(
  followerCount: number,
): "micro" | "mid" | "macro" | null {
  if (followerCount < 1000) return null;
  if (followerCount < 10000) return "micro";
  if (followerCount < 100000) return "mid";
  return "macro";
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
  tier: "micro" | "mid" | "macro",
  campaignType: "fixed" | "affiliate" | "hybrid",
): boolean {
  return TIER_LIMITS[tier].campaignTypes.includes(campaignType as any);
}

export function getMaxActiveCampaigns(
  tier: "micro" | "mid" | "macro",
): number {
  return TIER_LIMITS[tier].maxActiveCampaigns;
}
