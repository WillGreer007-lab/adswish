"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ScoreBreakdown } from "@/lib/socialverify/scoring";
import { calculateScore, type ScoreStatus } from "@/lib/socialverify/scoring";
import type { SocialPlatform } from "@/lib/socialverify/tokens";

const STATUS_COLORS: Record<ScoreStatus, string> = {
  highly_authentic: "text-emerald-600",
  authentic: "text-blue-600",
  suspicious: "text-amber-600",
  likely_fake: "text-red-600",
};

const CIRCUMFERENCE = 263.89;

export function ScoreDisplay({
  score,
  status,
  statusLabel,
  breakdown,
}: {
  score: number;
  status: ScoreStatus;
  statusLabel: string;
  breakdown: ScoreBreakdown;
}) {
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;
  const circleColor =
    score >= 85 ? "stroke-emerald-500" : score >= 65 ? "stroke-blue-500" : score >= 45 ? "stroke-amber-500" : "stroke-red-500";

  return (
    <div className="flex flex-col items-center gap-6 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-start">
      <div className="flex flex-col items-center">
        <div className="relative h-[100px] w-[100px]">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="7" className="text-border" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              className={circleColor}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums">{score}</span>
          </div>
        </div>
        <div className={cn("mt-2 text-sm", STATUS_COLORS[status])}>{statusLabel}</div>
      </div>

      <div className="flex-1 space-y-1">
        <MetricRow label="Engagement rate" value={`${breakdown.engagement_rate.value}%`} score={breakdown.engagement_rate.score} max={breakdown.engagement_rate.max} />
        <MetricRow label="Comment quality" value={`${breakdown.comment_quality.value}%`} score={breakdown.comment_quality.score} max={breakdown.comment_quality.max} />
        <MetricRow label="Posting consistency" value={`${breakdown.consistency.value}/d`} score={breakdown.consistency.score} max={breakdown.consistency.max} />
        <MetricRow label="Growth velocity" value={`${breakdown.growth_velocity.value}%`} score={breakdown.growth_velocity.score} max={breakdown.growth_velocity.max} />
        <MetricRow label="Cross-platform" value={breakdown.cross_platform.value ? "Yes" : "No"} score={breakdown.cross_platform.score} max={breakdown.cross_platform.max} />
      </div>
    </div>
  );
}

function MetricRow({ label, value, score, max }: { label: string; value: string; score: number; max: number }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  const barColor = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <div className="h-1 w-20 overflow-hidden rounded-full bg-border">
          <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-12 text-right text-sm font-medium tabular-nums">{value}</span>
      </div>
    </div>
  );
}

export function ScoreCalculator() {
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [followers, setFollowers] = useState(567000);
  const [likes, setLikes] = useState(18500);
  const [comments, setComments] = useState(420);
  const [shares, setShares] = useState(890);
  const [posts, setPosts] = useState(1240);
  const [age, setAge] = useState(1460);
  const [growth, setGrowth] = useState(12000);
  const [result, setResult] = useState<ReturnType<typeof calculateScore> | null>(null);

  const run = () => {
    setResult(
      calculateScore({
        platform,
        followers,
        avg_likes_per_post: likes,
        avg_comments_per_post: comments,
        avg_shares_per_post: shares,
        total_posts: posts,
        account_age_days: age,
        follower_growth_30d: growth,
        cross_platform_verified: true,
      }),
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-3 text-sm font-medium">🧮 No-API Authenticity Calculator</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Platform">
          <select value={platform} onChange={(e) => setPlatform(e.target.value as SocialPlatform)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="instagram">Instagram</option>
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="twitter">Twitter / X</option>
          </select>
        </Field>
        <Field label="Followers">
          <NumberInput value={followers} onChange={setFollowers} />
        </Field>
        <Field label="Avg Likes / Post">
          <NumberInput value={likes} onChange={setLikes} />
        </Field>
        <Field label="Avg Comments / Post">
          <NumberInput value={comments} onChange={setComments} />
        </Field>
        <Field label="Avg Shares / Post">
          <NumberInput value={shares} onChange={setShares} />
        </Field>
        <Field label="Total Posts">
          <NumberInput value={posts} onChange={setPosts} />
        </Field>
        <Field label="Account Age (days)">
          <NumberInput value={age} onChange={setAge} />
        </Field>
        <Field label="Growth (30d)">
          <NumberInput value={growth} onChange={setGrowth} />
        </Field>
      </div>

      <button type="button" onClick={run} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        Calculate Score
      </button>

      {result && (
        <div className="mt-4 rounded-lg bg-muted/30 p-3">
          <div className="text-2xl font-semibold">{result.score}/100</div>
          <div className="text-sm text-muted-foreground">{result.status_label}</div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
    />
  );
}
