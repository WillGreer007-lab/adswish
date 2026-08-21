import { NextRequest, NextResponse } from "next/server";
import {
  checkDeliverableDeadlines,
  checkSLADisputes,
  checkSubscriptionDunning,
  checkCampaignCompletion,
  checkPixelPenalty,
  aggregateDailyRollups,
  refreshAllBadges,
  syncGoogleAdsCampaigns,
  syncGoogleAdsReporting,
  runGoogleAdsKillSwitch,
  generateGoogleAdsThumbnails,
} from "@/lib/background-jobs";
import {
  releaseExpiredHolds,
  processWeeklyPayouts,
  generateMonthlyInvoices,
  retryExpiredCharges,
} from "@/lib/finance";
import { refreshExpiredTokens } from "@/lib/oauth/token-refresh";
import { recheckFollowerCounts } from "@/lib/follower-recheck";

type JobName =
  | "deadlines"
  | "sla"
  | "dunning"
  | "completion"
  | "pixel-penalty"
  | "release-holds"
  | "charge-retries"
  | "weekly-payouts"
  | "monthly-invoices"
  | "token-refresh"
  | "daily-rollup"
  | "badges"
  | "google-ads-sync"
  | "google-ads-reporting"
  | "google-ads-kill-switch"
  | "google-ads-thumbnails"
  | "follower-recheck";

const ALL_JOBS: JobName[] = [
  "deadlines",
  "sla",
  "dunning",
  "completion",
  "pixel-penalty",
  "release-holds",
  "charge-retries",
  "token-refresh",
];

async function run(job: JobName): Promise<unknown> {
  switch (job) {
    case "deadlines":
      await checkDeliverableDeadlines();
      return "checked";
    case "sla":
      await checkSLADisputes();
      return "checked";
    case "dunning":
      await checkSubscriptionDunning();
      return "checked";
    case "completion":
      await checkCampaignCompletion();
      return "checked";
    case "pixel-penalty":
      await checkPixelPenalty();
      return "checked";
    case "release-holds":
      return `released:${await releaseExpiredHolds()}`;
    case "charge-retries":
      return `handled:${await retryExpiredCharges()}`;
    case "weekly-payouts":
      return `paid_out:${await processWeeklyPayouts()}`;
    case "monthly-invoices":
      return `generated:${await generateMonthlyInvoices()}`;
    case "token-refresh":
      await refreshExpiredTokens();
      return "refreshed";
    case "daily-rollup":
      return `upserted:${await aggregateDailyRollups()}`;
    case "badges":
      return `refreshed:${await refreshAllBadges()}`;
    case "google-ads-sync":
      return `synced:${await syncGoogleAdsCampaigns()}`;
    case "google-ads-reporting":
      return `synced:${await syncGoogleAdsReporting()}`;
    case "google-ads-kill-switch":
      return `paused:${await runGoogleAdsKillSwitch()}`;
    case "google-ads-thumbnails":
      return `generated:${await generateGoogleAdsThumbnails()}`;
    case "follower-recheck":
      return `result:${JSON.stringify(await recheckFollowerCounts())}`;
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "adswish-cron";

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional body: { "jobs": ["release-holds"] } — pg_cron passes this to
  // target a specific job. Without it, the hourly job set runs (back-compat).
  let jobs: JobName[] = ALL_JOBS;
  try {
    const body = (await request.json()) as { jobs?: JobName[] };
    if (Array.isArray(body.jobs) && body.jobs.length > 0) {
      jobs = body.jobs;
    }
  } catch {
    // no body — run the default set
  }

  const results: Record<string, unknown> = {};
  for (const job of jobs) {
    try {
      results[job] = await run(job);
    } catch (e) {
      results[job] = `error: ${e}`;
    }
  }

  return NextResponse.json({ success: true, results });
}
