"use client";

import { cn } from "@/lib/utils";
import type { ScoreResult, ScoreBreakdown } from "@/lib/authenticity-scoring";

const STATUS_COLORS: Record<string, string> = {
  highly_authentic: "text-emerald-600",
  authentic: "text-blue-600",
  suspicious: "text-amber-600",
  likely_fake: "text-red-600",
};

interface ScoreDisplayProps {
  score: ScoreResult;
}

export function ScoreDisplay({ score }: ScoreDisplayProps) {
  const circumference = 263.89;
  const offset = circumference - (score.score / 100) * circumference;

  const circleColor =
    score.score >= 85
      ? "stroke-emerald-500"
      : score.score >= 65
        ? "stroke-blue-500"
        : score.score >= 45
          ? "stroke-amber-500"
          : "stroke-red-500";

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        {/* Score ring */}
        <div className="flex flex-col items-center">
          <div className="relative h-[100px] w-[100px]">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="7" className="text-border" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                strokeWidth="7"
                strokeLinecap="round"
                className={circleColor}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-semibold tabular-nums">{score.score}</span>
            </div>
          </div>
          <div className={cn("mt-2 text-sm", STATUS_COLORS[score.status])}>
            {score.status_label}
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex-1 space-y-3">
          <MetricRow label="Engagement rate" value={`${score.breakdown.engagement_rate.value}%`} score={score.breakdown.engagement_rate.score} max={score.breakdown.engagement_rate.max} />
          <MetricRow label="Comment quality" value={`${score.breakdown.comment_quality.value}%`} score={score.breakdown.comment_quality.score} max={score.breakdown.comment_quality.max} />
          <MetricRow label="Posting consistency" value={`${score.breakdown.consistency.value}/d`} score={score.breakdown.consistency.score} max={score.breakdown.consistency.max} />
          <MetricRow label="Growth velocity" value={`${score.breakdown.growth_velocity.value}%`} score={score.breakdown.growth_velocity.score} max={score.breakdown.growth_velocity.max} />
          <MetricRow label="Cross-platform" value={score.breakdown.cross_platform.value ? "Yes" : "No"} score={score.breakdown.cross_platform.score} max={score.breakdown.cross_platform.max} />
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, score, max }: { label: string; value: string; score: number; max: number }) {
  const percentage = max > 0 ? (score / max) * 100 : 0;
  const barColor =
    percentage >= 70 ? "bg-emerald-500" : percentage >= 40 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <div className="h-1 w-20 overflow-hidden rounded-full bg-border">
          <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${percentage}%` }} />
        </div>
        <span className="w-12 text-right text-sm font-medium tabular-nums">{value}</span>
      </div>
    </div>
  );
}
