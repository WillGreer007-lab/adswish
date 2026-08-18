import { NextRequest, NextResponse } from "next/server";
import {
  checkDeliverableDeadlines,
  checkSLADisputes,
  checkSubscriptionDunning,
  checkCampaignCompletion,
  checkPixelPenalty,
} from "@/lib/background-jobs";
import {
  releaseExpiredHolds,
  processWeeklyPayouts,
  generateMonthlyInvoices,
  retryExpiredCharges,
} from "@/lib/finance";

type JobName =
  | "deadlines"
  | "sla"
  | "dunning"
  | "completion"
  | "pixel-penalty"
  | "release-holds"
  | "charge-retries"
  | "weekly-payouts"
  | "monthly-invoices";

const ALL_JOBS: JobName[] = [
  "deadlines",
  "sla",
  "dunning",
  "completion",
  "pixel-penalty",
  "release-holds",
  "charge-retries",
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
