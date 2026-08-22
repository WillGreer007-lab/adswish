import { describe, it, expect } from "vitest";
import {
  BENCHMARKS,
  parsePostMetrics,
  aggregateMetrics,
  signMetrics,
  verifySignedMetrics,
  generateChallenge,
  calculateScore,
  type ScoreInput,
} from "./scoring";

const SECRET = "test-secret-key";

function baseInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    platform: "instagram",
    followers: 100000,
    avg_likes_per_post: 3000,
    avg_comments_per_post: 60,
    avg_shares_per_post: 20,
    total_posts: 500,
    account_age_days: 1000,
    follower_growth_30d: 2000,
    cross_platform_verified: true,
    ...overrides,
  };
}

describe("parsePostMetrics", () => {
  it("extracts YouTube like/comment counts", () => {
    const html = `"likeCount":"15400","viewCount":"245000","commentCount":"890"`;
    const m = parsePostMetrics(html, "youtube");
    expect(m.likes).toBe(15400);
    expect(m.views).toBe(245000);
    expect(m.comments).toBe(890);
  });

  it("extracts TikTok metrics", () => {
    const html = `{"diggCount": 45000, "commentCount": 1200, "shareCount": 3400, "playCount": 320000}`;
    const m = parsePostMetrics(html, "tiktok");
    expect(m.likes).toBe(45000);
    expect(m.comments).toBe(1200);
    expect(m.shares).toBe(3400);
  });

  it("returns zeros when metrics are absent", () => {
    const m = parsePostMetrics("<html>nothing</html>", "instagram");
    expect(m.likes).toBe(0);
    expect(m.comments).toBe(0);
  });
});

describe("aggregateMetrics", () => {
  it("averages likes/comments/shares across posts", () => {
    const agg = aggregateMetrics([
      { url: "", platform: "instagram", likes: 100, comments: 10, shares: 2, views: 0 },
      { url: "", platform: "instagram", likes: 200, comments: 20, shares: 6, views: 0 },
    ]);
    expect(agg.avg_likes).toBe(150);
    expect(agg.avg_comments).toBe(15);
    expect(agg.avg_shares).toBe(4);
    expect(agg.total_posts).toBe(2);
  });

  it("returns zeros for an empty list", () => {
    const agg = aggregateMetrics([]);
    expect(agg.avg_likes).toBe(0);
    expect(agg.total_posts).toBe(0);
  });
});

describe("signMetrics / verifySignedMetrics", () => {
  it("signs and verifies a round trip", () => {
    const signed = signMetrics("biz-1", "twitter", { avg_likes: 10, avg_comments: 2 }, SECRET);
    const verified = verifySignedMetrics(signed.signed_claim, signed.signature, SECRET);
    expect(verified.valid).toBe(true);
    expect(verified.platform).toBe("twitter");
    expect(verified.metrics?.avg_likes).toBe(10);
  });

  it("rejects a bad signature", () => {
    const signed = signMetrics("biz-1", "twitter", { avg_likes: 10 }, SECRET);
    expect(verifySignedMetrics(signed.signed_claim, "bad", SECRET).valid).toBe(false);
  });
});

describe("generateChallenge", () => {
  it("produces a per-platform challenge with the token embedded", () => {
    const c = generateChallenge("instagram", "TOKEN123");
    expect(c.platform).toBe("instagram");
    expect(c.challenge_text).toContain("TOKEN123");
    expect(c.criteria.minimum_real_responses).toBe(10);
  });
});

describe("calculateScore", () => {
  it("returns a valid score and breakdown", () => {
    const result = calculateScore(baseInput());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.breakdown.engagement_rate.max).toBe(40);
    expect(result.breakdown.comment_quality.max).toBe(30);
  });

  it("returns no followers for zero followers", () => {
    const result = calculateScore(baseInput({ followers: 0 }));
    expect(result.score).toBe(0);
    expect(result.status_label).toBe("No followers");
  });

  it("scores highly authentic for strong cross-platform engagement", () => {
    const result = calculateScore(
      baseInput({
        followers: 100000,
        avg_likes_per_post: 4000,
        avg_comments_per_post: 200,
        avg_shares_per_post: 100,
        cross_platform_verified: true,
        challenge_bonus: 5,
      }),
    );
    expect(result.status).toBe("highly_authentic");
  });

  it("caps the challenge bonus at 5", () => {
    const result = calculateScore(baseInput({ challenge_bonus: 999 }));
    expect(result.breakdown.challenge_bonus.score).toBe(5);
  });

  it("benchmarks match the spec", () => {
    expect(BENCHMARKS.youtube).toEqual({ low: 1.0, high: 5.0 });
    expect(BENCHMARKS.twitter).toEqual({ low: 0.5, high: 3.0 });
  });
});
