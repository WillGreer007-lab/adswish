export type IntegrationDef = {
  key: string;
  name: string;
  /** Short glyph shown inside the tile. */
  mark: string;
  /** Tailwind background class for the tile. */
  tileClass: string;
  description: string;
  /** Critical integrations are platform core; they are locked and always count. */
  critical: boolean;
};

/**
 * Per-plan integration allowance. The five critical integrations always count
 * toward this total, so the number of optional integrations a user can add is
 * `limit - CRITICAL_INTEGRATIONS.length`.
 */
export const INTEGRATION_PLAN_LIMITS: Record<string, number> = {
  business_free: 6,
  business_growth: 10,
  business_enterprise: 20,
  creator_free: 6,
  creator_pro: 10,
  creator_premium: 20,
};

/**
 * The core platform integrations. These power Adswish itself and are shown
 * locked (blurred, no remove button). They always count as one slot each.
 */
export const CRITICAL_INTEGRATIONS: IntegrationDef[] = [
  { key: "stripe", name: "Stripe", mark: "S", tileClass: "bg-violet-600", description: "Payment processing and payouts", critical: true },
  { key: "resend", name: "Resend", mark: "✉", tileClass: "bg-sky-600", description: "Transactional email delivery", critical: true },
  { key: "supabase", name: "Supabase", mark: "◆", tileClass: "bg-emerald-600", description: "Database, auth, and storage", critical: true },
  { key: "upstash", name: "Upstash", mark: "⚡", tileClass: "bg-red-600", description: "Redis rate limiting", critical: true },
  { key: "sightengine", name: "Sightengine", mark: "◎", tileClass: "bg-orange-600", description: "Content moderation and NSFW detection", critical: true },
];

/**
 * Optional integrations users can connect as they become available. All are
 * "coming soon" until the corresponding OAuth flow ships.
 */
export const OPTIONAL_INTEGRATIONS: IntegrationDef[] = [
  { key: "google_ads", name: "Google Ads", mark: "G", tileClass: "bg-blue-600", description: "Amplify creator content with paid search & display ads", critical: false },
  { key: "meta_ads", name: "Meta Ads", mark: "M", tileClass: "bg-blue-700", description: "Run ads on Facebook & Instagram", critical: false },
  { key: "tiktok_ads", name: "TikTok Ads", mark: "T", tileClass: "bg-neutral-900", description: "Promote content as native TikTok ads", critical: false },
  { key: "youtube_ads", name: "YouTube Ads", mark: "Y", tileClass: "bg-red-600", description: "Pre-roll, discovery, and Shorts ads", critical: false },
  { key: "instagram_ads", name: "Instagram Ads", mark: "I", tileClass: "bg-pink-600", description: "Boost posts, stories, and reels", critical: false },
  { key: "x_ads", name: "X Ads", mark: "X", tileClass: "bg-neutral-900", description: "Promote posts and timeline ads", critical: false },
  { key: "linkedin_ads", name: "LinkedIn Ads", mark: "in", tileClass: "bg-sky-700", description: "B2B targeting and sponsored content", critical: false },
  { key: "pinterest_ads", name: "Pinterest Ads", mark: "P", tileClass: "bg-red-700", description: "Promote pins and shopping ads", critical: false },
  { key: "snapchat_ads", name: "Snapchat Ads", mark: "Sn", tileClass: "bg-amber-500", description: "Snap ads and AR lens campaigns", critical: false },
];

export const ALL_INTEGRATIONS: IntegrationDef[] = [...CRITICAL_INTEGRATIONS, ...OPTIONAL_INTEGRATIONS];

export function integrationLimitForPlan(planSlug: string | null | undefined): number {
  return INTEGRATION_PLAN_LIMITS[planSlug ?? "business_free"] ?? 6;
}
