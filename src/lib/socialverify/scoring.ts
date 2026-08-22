import { createHmac } from "node:crypto";
import type { SocialPlatform } from "./tokens";
import { canonicalJson } from "./canonical";

/**
 * SocialVerify — no-API authenticity scoring.
 *
 * Three data-collection methods (no API keys required):
 *   1. Public post sampling — HTTP + regex on public HTML/JSON-LD.
 *   2. Self-reported signed metrics — creator HMAC-signs their numbers.
 *   3. Challenge verification — creator posts a public challenge.
 *
 * Five scoring components on a 100-point scale:
 *   engagement rate (40), comment quality (30), posting consistency (15),
 *   growth velocity (15), cross-platform (10), challenge bonus (5).
 */

// ============================================================
// Platform benchmarks (engagement rate %)
// ============================================================

export interface Benchmark {
  low: number;
  high: number;
}

export const BENCHMARKS: Record<SocialPlatform, Benchmark> = {
  youtube: { low: 1.0, high: 5.0 },
  tiktok: { low: 3.0, high: 10.0 },
  instagram: { low: 1.5, high: 6.0 },
  twitter: { low: 0.5, high: 3.0 },
};

// ============================================================
// Public post sampling (regex on HTML)
// ============================================================

export interface PostMetrics {
  url: string;
  platform: SocialPlatform;
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

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
 * Parse engagement metrics from a single HTML string (no network here — the
 * caller fetches the page and passes the HTML).
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

export interface AggregatedMetrics {
  avg_likes: number;
  avg_comments: number;
  avg_shares: number;
  total_posts: number;
}

/**
 * Aggregate metrics across multiple post samples.
 */
export function aggregateMetrics(posts: PostMetrics[]): AggregatedMetrics {
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
// Self-reported signed metrics
// ============================================================

export interface SignedMetrics {
  payload: { business_id: string; platform: string; metrics: Record<string, number>; reported_at: number; version: string };
  signature: string;
  signed_claim: string;
  penalty_for_fraud: string;
}

export function signMetrics(
  businessId: string,
  platform: string,
  metrics: Record<string, number>,
  secretKey: string,
): SignedMetrics {
  const payload = {
    business_id: businessId,
    platform,
    metrics,
    reported_at: Math.floor(Date.now() / 1000),
    version: "v1",
  };
  const payloadJson = canonicalJson(payload);
  const signature = createHmac("sha256", secretKey).update(payloadJson).digest("hex");
  const signedClaim = `METRICS-${Buffer.from(payloadJson).toString("base64url")}`;

  return {
    payload,
    signature,
    signed_claim: signedClaim,
    penalty_for_fraud: "Permanent ban + public audit flag",
  };
}

export function verifySignedMetrics(
  signedClaim: string,
  signature: string,
  secretKey: string,
): { valid: boolean; metrics: Record<string, number> | null; platform: string | null } {
  try {
    const body = signedClaim.replace(/^METRICS-/, "");
    const padding = 4 - (body.length % 4);
    const padded = padding !== 4 ? body + "=".repeat(padding) : body;
    const payloadJson = Buffer.from(padded, "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson);
    const expectedSig = createHmac("sha256", secretKey).update(payloadJson).digest("hex");

    return {
      valid: timingSafeEqual(expectedSig, signature),
      metrics: payload.metrics ?? null,
      platform: payload.platform ?? null,
    };
  } catch {
    return { valid: false, metrics: null, platform: null };
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ============================================================
// Challenge verification
// ============================================================

export const CHALLENGE_TEMPLATES: Record<SocialPlatform, string> = {
  youtube: "Comment below with the word 'VERIFY' and your favorite emoji! #{token}",
  tiktok: "Stitch this with your token {token} to verify you're a real follower!",
  instagram: "Comment your city + {token} below! Real followers only.",
  twitter: "Reply with {token} and tell us what content you want next. Bots can't do this.",
};

export interface Challenge {
  platform: SocialPlatform;
  challenge_text: string;
  criteria: {
    minimum_real_responses: number;
    minimum_unique_users: number;
    no_duplicate_text: boolean;
    minimum_text_length: number;
  };
}

export function generateChallenge(platform: SocialPlatform, token: string): Challenge {
  const template = CHALLENGE_TEMPLATES[platform] ?? CHALLENGE_TEMPLATES.twitter;
  return {
    platform,
    challenge_text: template.replace("{token}", token),
    criteria: {
      minimum_real_responses: 10,
      minimum_unique_users: 5,
      no_duplicate_text: true,
      minimum_text_length: 15,
    },
  };
}

// ============================================================
// Authenticity scorer
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
  challenge_bonus?: number;
}

export type ScoreStatus = "highly_authentic" | "authentic" | "suspicious" | "likely_fake";

export interface ScoreBreakdown {
  engagement_rate: { value: number; score: number; max: number };
  comment_quality: { value: number; score: number; max: number };
  consistency: { value: number; score: number; max: number };
  growth_velocity: { value: number; score: number; max: number };
  cross_platform: { value: boolean; score: number; max: number };
  challenge_bonus: { score: number; max: number };
}

export interface ScoreResult {
  score: number;
  status: ScoreStatus;
  status_label: string;
  breakdown: ScoreBreakdown;
}

const STATUS_LABELS: Record<ScoreStatus, string> = {
  highly_authentic: "Highly Authentic",
  authentic: "Authentic",
  suspicious: "Some Suspicious Patterns",
  likely_fake: "Likely Inauthentic",
};

function emptyBreakdown(): ScoreBreakdown {
  return {
    engagement_rate: { value: 0, score: 0, max: 40 },
    comment_quality: { value: 0, score: 0, max:30 },
    consistency: { value: 0, score: 0, max: 15 },
    growth_velocity: { value: 0, score: 0, max: 15 },
    cross_platform: { value: false, score: 0, max: 10 },
    challenge_bonus: { score: 0, max: 5 },
  };
}

/**
 * Calculate the authenticity score from aggregated metrics.
 */
export function calculateScore(input: ScoreInput): ScoreResult {
  const bench = BENCHMARKS[input.platform];
  const { followers } = input;

  if (followers === 0) {
    return { score: 0, status: "likely_fake", status_label: "No followers", breakdown: emptyBreakdown() };
  }

  // 1. Engagement rate (0-40)
  const totalEngagement = input.avg_likes_per_post + input.avg_comments_per_post + input.avg_shares_per_post;
  const engagementRate = (totalEngagement / followers) * 100;

  let engagementScore: number;
  if (engagementRate < bench.low) engagementScore = Math.max(0, (engagementRate / bench.low) * 20);
  else if (engagementRate > bench.high) engagementScore = 40;
  else engagementScore = 20 + ((engagementRate - bench.low) / (bench.high - bench.low)) * 20;

  // 2. Comment quality (0-30)
  const commentRatio = input.avg_likes_per_post > 0 ? (input.avg_comments_per_post / input.avg_likes_per_post) * 100 : 0;
  let commentScore: number;
  if (commentRatio < 0.5) commentScore = 5;
  else if (commentRatio < 2.0) commentScore = 15;
  else if (commentRatio < 5.0) commentScore = 25;
  else commentScore = 30;

  // 3. Posting consistency (0-15)
  const postsPerDay = input.account_age_days > 0 ? input.total_posts / input.account_age_days : 0;
  let consistencyScore: number;
  if (postsPerDay >= 0.1 && postsPerDay <= 3.0) consistencyScore = 15;
  else if (postsPerDay < 0.05) consistencyScore = 5;
  else consistencyScore = 8;

  // 4. Growth velocity (0-15)
  const growthRate = followers > 0 ? (input.follower_growth_30d / followers) * 100 : 0;
  let velocityScore: number;
  if (growthRate < 5) velocityScore = 15;
  else if (growthRate < 15) velocityScore = 10;
  else if (growthRate < 30) velocityScore = 5;
  else velocityScore = 2;

  // 5. Cross-platform (0-10)
  const crossScore = input.cross_platform_verified ? 10 : 0;

  // 6. Challenge bonus (0-5)
  const challengeBonus = Math.min(5, input.challenge_bonus ?? 0);

  const totalScore = Math.min(
    100,
    Math.round((engagementScore + commentScore + consistencyScore + velocityScore + crossScore + challengeBonus) * 10) / 10,
  );

  let status: ScoreStatus;
  if (totalScore >= 85) status = "highly_authentic";
  else if (totalScore >= 65) status = "authentic";
  else if (totalScore >= 45) status = "suspicious";
  else status = "likely_fake";

  return {
    score: totalScore,
    status,
    status_label: STATUS_LABELS[status],
    breakdown: {
      engagement_rate: { value: round1(engagementRate), score: round1(engagementScore), max: 40 },
      comment_quality: { value: round1(commentRatio), score: round1(commentScore), max: 30 },
      consistency: { value: round1(postsPerDay), score: round1(consistencyScore), max: 15 },
      growth_velocity: { value: round1(growthRate), score: round1(velocityScore), max: 15 },
      cross_platform: { value: input.cross_platform_verified, score: crossScore, max: 10 },
      challenge_bonus: { score: round1(challengeBonus), max: 5 },
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
