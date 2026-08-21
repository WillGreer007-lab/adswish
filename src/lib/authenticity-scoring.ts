/**
 * No-API authenticity scoring for SocialVerify.
 *
 * Three data-collection methods:
 *   1. Public post sampling (regex on HTML, no API keys)
 *   2. Self-reported signed metrics (HMAC-signed by creator)
 *   3. Challenge verification (real-human engagement proof)
 *
 * Five scoring components (100-point scale):
 *   - Engagement rate (40pts)
 *   - Comment quality (30pts)
 *   - Posting consistency (15pts)
 *   - Growth velocity (15pts)
 *   - Cross-platform verified (10pts)
 */

import type { SocialPlatform } from "./verification-token";

// ============================================================
// Platform benchmarks
// ============================================================

export interface PlatformBenchmark {
  low: number;   // below this = suspicious
  high: number;  // above this = excellent
}

export const PLATFORM_BENCHMARKS: Record<SocialPlatform, PlatformBenchmark> = {
  youtube: { low: 1.0, high: 5.0 },
  tiktok: { low: 3.0, high: 10.0 },
  instagram: { low: 1.5, high: 6.0 },
  twitter: { low: 0.5, high: 3.0 },
};

// ============================================================
// Public post sampling (no API keys)
// ============================================================

export interface PostMetrics {
  url: string;
  platform: SocialPlatform;
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

/**
 * Regex patterns for extracting engagement metrics from public HTML.
 * These target the JSON-LD / meta tags that platforms embed in their pages.
 */
export const POST_METRIC_PATTERNS: Record<SocialPlatform, Record<string, string>> = {
  youtube: {
    likes: '"likeCount":"?(\\d+)[",\\s]',
    views: '"viewCount":"?(\\d+)[",\\s]',
    comments: '"commentCount":"?(\\d+)[",\\s]',
  },
  tiktok: {
    likes: '"diggCount":\\s*(\\d+)',
    comments: '"commentCount":\\s*(\\d+)',
    shares: '"shareCount":\\s*(\\d+)',
    views: '"playCount":\\s*(\\d+)',
  },
  instagram: {
    likes: '"edge_media_preview_like":\\s*\\{\\s*"count":\\s*(\\d+)',
    comments: '"edge_media_to_parent_comment":\\s*\\{\\s*"count":\\s*(\\d+)',
    views: '"video_view_count":\\s*(\\d+)',
  },
  twitter: {
    likes: '"favoriteCount":\\s*(\\d+)',
    shares: '"retweetCount":\\s*(\\d+)',
    comments: '"replyCount":\\s*(\\d+)',
    views: '"viewCount":\\s*(\\d+)',
  },
};

/**
 * Parse engagement metrics from a single HTML string.
 */
export function parsePostMetrics(html: string, platform: SocialPlatform): PostMetrics {
  const patterns = POST_METRIC_PATTERNS[platform];
  const extract = (key: string): number => {
    const pattern = patterns[key];
    if (!pattern) return 0;
    const match = html.match(new RegExp(pattern));
    return match ? parseInt(match[1], 10) : 0;
  };

  return {
    url: "",
    platform,
    likes: extract("likes"),
    comments: extract("comments"),
    shares: extract("shares"),
    views: extract("views"),
  };
}

/**
 * Aggregate metrics from multiple post samples into averages.
 */
export function aggregateMetrics(posts: PostMetrics[]): {
  avg_likes: number;
  avg_comments: number;
  avg_shares: number;
  total_posts: number;
} {
  if (posts.length === 0) {
    return { avg_likes: 0, avg_comments: 0, avg_shares: 0, total_posts: 0 };
  }

  const totals = posts.reduce(
    (acc, p) => ({
      likes: acc.likes + p.likes,
      comments: acc.comments + p.comments,
      shares: acc.shares + p.shares,
    }),
    { likes: 0, comments: 0, shares: 0 },
  );

  return {
    avg_likes: Math.round(totals.likes / posts.length),
    avg_comments: Math.round(totals.comments / posts.length),
    avg_shares: Math.round(totals.shares / posts.length),
    total_posts: posts.length,
  };
}

// ============================================================
// Authenticity scoring
// ============================================================

export interface ScoreInput {
  platform: SocialPlatform;
  followers: number;
  avg_likes_per_post: number;
  avg_comments_per_post: number;
  avg_shares_per_post: number;
  total_posts: number;
  account_age_days: number;
  follower_growth_30d: number;
  cross_platform_verified: boolean;
}

export interface ScoreBreakdown {
  engagement_rate: { value: number; score: number; max: number };
  comment_quality: { value: number; score: number; max: number };
  consistency: { value: number; score: number; max: number };
  growth_velocity: { value: number; score: number; max: number };
  cross_platform: { value: boolean; score: number; max: number };
}

export type ScoreStatus = "highly_authentic" | "authentic" | "suspicious" | "likely_fake";

export interface ScoreResult {
  score: number;
  status: ScoreStatus;
  status_label: string;
  breakdown: ScoreBreakdown;
}

/**
 * Calculate authenticity score from available metrics.
 * No API keys needed — works with scraped or self-reported data.
 */
export function calculateAuthenticityScore(input: ScoreInput): ScoreResult {
  const { platform, followers } = input;
  const bench = PLATFORM_BENCHMARKS[platform];

  if (followers === 0) {
    return {
      score: 0,
      status: "likely_fake",
      status_label: "No followers",
      breakdown: emptyBreakdown(),
    };
  }

  // 1. Engagement rate (0-40)
  const totalEngagement =
    input.avg_likes_per_post + input.avg_comments_per_post + input.avg_shares_per_post;
  const engagementRate = (totalEngagement / followers) * 100;

  let engagementScore: number;
  if (engagementRate < bench.low) {
    engagementScore = Math.max(0, (engagementRate / bench.low) * 20);
  } else if (engagementRate > bench.high) {
    engagementScore = 40;
  } else {
    engagementScore =
      20 + ((engagementRate - bench.low) / (bench.high - bench.low)) * 20;
  }

  // 2. Comment quality (0-30)
  const commentRatio =
    input.avg_likes_per_post > 0
      ? (input.avg_comments_per_post / input.avg_likes_per_post) * 100
      : 0;

  let commentScore: number;
  if (commentRatio < 0.5) commentScore = 5;
  else if (commentRatio < 2.0) commentScore = 15;
  else if (commentRatio < 5.0) commentScore = 25;
  else commentScore = 30;

  // 3. Posting consistency (0-15)
  const postsPerDay =
    input.account_age_days > 0 ? input.total_posts / input.account_age_days : 0;

  let consistencyScore: number;
  if (postsPerDay >= 0.1 && postsPerDay <= 3.0) consistencyScore = 15;
  else if (postsPerDay < 0.05) consistencyScore = 5;
  else consistencyScore = 8;

  // 4. Growth velocity (0-15)
  const growthRate =
    followers > 0 ? (input.follower_growth_30d / followers) * 100 : 0;

  let velocityScore: number;
  if (growthRate < 5) velocityScore = 15;
  else if (growthRate < 15) velocityScore = 10;
  else if (growthRate < 30) velocityScore = 5;
  else velocityScore = 2;

  // 5. Cross-platform (0-10)
  const crossScore = input.cross_platform_verified ? 10 : 0;

  const totalScore = Math.min(
    100,
    Math.round(
      (engagementScore + commentScore + consistencyScore + velocityScore + crossScore) * 10,
    ) / 10,
  );

  let status: ScoreStatus;
  if (totalScore >= 85) status = "highly_authentic";
  else if (totalScore >= 65) status = "authentic";
  else if (totalScore >= 45) status = "suspicious";
  else status = "likely_fake";

  const statusLabels: Record<ScoreStatus, string> = {
    highly_authentic: "Highly Authentic",
    authentic: "Authentic",
    suspicious: "Some Suspicious Patterns",
    likely_fake: "Likely Inauthentic",
  };

  return {
    score: totalScore,
    status,
    status_label: statusLabels[status],
    breakdown: {
      engagement_rate: {
        value: Math.round(engagementRate * 100) / 100,
        score: Math.round(engagementScore * 10) / 10,
        max: 40,
      },
      comment_quality: {
        value: Math.round(commentRatio * 100) / 100,
        score: Math.round(commentScore * 10) / 10,
        max: 30,
      },
      consistency: {
        value: Math.round(postsPerDay * 100) / 100,
        score: Math.round(consistencyScore * 10) / 10,
        max: 15,
      },
      growth_velocity: {
        value: Math.round(growthRate * 100) / 100,
        score: Math.round(velocityScore * 10) / 10,
        max: 15,
      },
      cross_platform: {
        value: input.cross_platform_verified,
        score: crossScore,
        max: 10,
      },
    },
  };
}

function emptyBreakdown(): ScoreBreakdown {
  return {
    engagement_rate: { value: 0, score: 0, max: 40 },
    comment_quality: { value: 0, score: 0, max: 30 },
    consistency: { value: 0, score: 0, max: 15 },
    growth_velocity: { value: 0, score: 0, max: 15 },
    cross_platform: { value: false, score: 0, max: 10 },
  };
}
