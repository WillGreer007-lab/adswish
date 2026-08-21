import { describe, it, expect } from "vitest";
import {
  calculateAuthenticityScore,
  parsePostMetrics,
  aggregateMetrics,
} from "@/lib/authenticity-scoring";
import type { SocialPlatform } from "@/lib/verification-token";

describe("parsePostMetrics", () => {
  it("extracts YouTube metrics from HTML", () => {
    const html = '"likeCount":"15400","viewCount":"245000","commentCount":"890"';
    const result = parsePostMetrics(html, "youtube");
    expect(result.likes).toBe(15400);
    expect(result.views).toBe(245000);
    expect(result.comments).toBe(890);
  });

  it("extracts TikTok metrics from HTML", () => {
    const html = '"diggCount": 45000, "commentCount": 1200, "shareCount": 3400, "playCount": 320000';
    const result = parsePostMetrics(html, "tiktok");
    expect(result.likes).toBe(45000);
    expect(result.comments).toBe(1200);
    expect(result.shares).toBe(3400);
    expect(result.views).toBe(320000);
  });

  it("extracts Twitter metrics from HTML", () => {
    const html = '"favoriteCount": 3200, "retweetCount": 890, "replyCount": 245';
    const result = parsePostMetrics(html, "twitter");
    expect(result.likes).toBe(3200);
    expect(result.shares).toBe(890);
    expect(result.comments).toBe(245);
  });

  it("returns zeros for empty HTML", () => {
    const result = parsePostMetrics("<html></html>", "youtube");
    expect(result.likes).toBe(0);
    expect(result.views).toBe(0);
    expect(result.comments).toBe(0);
  });
});

describe("aggregateMetrics", () => {
  it("averages multiple posts", () => {
    const posts = [
      { url: "", platform: "youtube" as SocialPlatform, likes: 100, comments: 10, shares: 5, views: 1000 },
      { url: "", platform: "youtube" as SocialPlatform, likes: 200, comments: 20, shares: 10, views: 2000 },
    ];
    const result = aggregateMetrics(posts);
    expect(result.avg_likes).toBe(150);
    expect(result.avg_comments).toBe(15);
    expect(result.avg_shares).toBe(8); // 7.5 rounded
    expect(result.total_posts).toBe(2);
  });

  it("handles empty array", () => {
    const result = aggregateMetrics([]);
    expect(result.avg_likes).toBe(0);
    expect(result.total_posts).toBe(0);
  });
});

describe("calculateAuthenticityScore", () => {
  it("returns 0 for zero followers", () => {
    const result = calculateAuthenticityScore({
      platform: "youtube",
      followers: 0,
      avg_likes_per_post: 100,
      avg_comments_per_post: 10,
      avg_shares_per_post: 5,
      total_posts: 100,
      account_age_days: 365,
      follower_growth_30d: 100,
      cross_platform_verified: false,
    });
    expect(result.score).toBe(0);
    expect(result.status).toBe("likely_fake");
  });

  it("scores a healthy Instagram account highly", () => {
    const result = calculateAuthenticityScore({
      platform: "instagram",
      followers: 567000,
      avg_likes_per_post: 18500,
      avg_comments_per_post: 420,
      avg_shares_per_post: 890,
      total_posts: 1240,
      account_age_days: 1460,
      follower_growth_30d: 12000,
      cross_platform_verified: true,
    });
    expect(result.score).toBeGreaterThan(60);
    expect(result.status).not.toBe("likely_fake");
    expect(result.breakdown.engagement_rate.max).toBe(40);
    expect(result.breakdown.comment_quality.max).toBe(30);
    expect(result.breakdown.cross_platform.value).toBe(true);
  });

  it("scores below benchmarks as suspicious", () => {
    const result = calculateAuthenticityScore({
      platform: "twitter",
      followers: 10000,
      avg_likes_per_post: 10,
      avg_comments_per_post: 1,
      avg_shares_per_post: 0,
      total_posts: 5,
      account_age_days: 365,
      follower_growth_30d: 5000,
      cross_platform_verified: false,
    });
    expect(result.score).toBeLessThan(50);
    expect(result.status).toBe("likely_fake");
  });

  it("applies cross-platform bonus", () => {
    // Use lower engagement so the score isn't already capped at 100
    const withCross = calculateAuthenticityScore({
      platform: "youtube",
      followers: 50000,
      avg_likes_per_post: 1000,
      avg_comments_per_post: 50,
      avg_shares_per_post: 25,
      total_posts: 200,
      account_age_days: 730,
      follower_growth_30d: 500,
      cross_platform_verified: true,
    });
    const withoutCross = calculateAuthenticityScore({
      platform: "youtube",
      followers: 50000,
      avg_likes_per_post: 1000,
      avg_comments_per_post: 50,
      avg_shares_per_post: 25,
      total_posts: 200,
      account_age_days: 730,
      follower_growth_30d: 500,
      cross_platform_verified: false,
    });
    expect(withCross.score).toBe(withoutCross.score + 10);
    expect(withCross.score).toBeLessThanOrEqual(100);
  });
});
