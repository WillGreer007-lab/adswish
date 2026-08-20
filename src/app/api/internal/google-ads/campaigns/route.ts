import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getConnection, getValidAccessToken } from "@/lib/google-ads/connection";
import { listAccessibleCustomers, listCampaigns, GoogleAdsNotConfiguredError } from "@/lib/google-ads/client";
import { isGoogleAdsConfigured } from "@/lib/google-ads/oauth";
import {
  createCampaignRecord,
  listCampaignRecords,
  stampGoogleCampaignId,
  logActivity,
} from "@/lib/google-ads/campaigns";

const GOALS = ["search", "social", "pmax"] as const;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const local = await listCampaignRecords(user.id);
  const live: unknown[] = [];

  if (isGoogleAdsConfigured()) {
    try {
      const token = await getValidAccessToken(user.id);
      const conn = await getConnection(user.id);
      if (token) {
        const customerId = conn?.google_customer_id ?? (await listAccessibleCustomers(token))[0];
        if (customerId) {
          live.push(...(await listCampaigns(token, customerId)));
        }
      }
    } catch {
      /* live list is best-effort; local records always return */
    }
  }

  return NextResponse.json({ campaigns: local, live });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const goal = GOALS.includes(body.goal) ? body.goal : "search";
  const targetLocation = typeof body.location === "string" ? body.location.trim() : "";
  const dailyBudget = Math.round(Number(body.dailyBudget) * 100); // pounds -> cents
  const launch = body.launch === true;

  if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) {
    return NextResponse.json({ error: "A daily budget is required" }, { status: 400 });
  }

  const record = await createCampaignRecord(user.id, {
    goal,
    targetLocation: targetLocation || undefined,
    dailyBudgetCents: dailyBudget,
    adswishCampaignId: typeof body.adswishCampaignId === "string" ? body.adswishCampaignId : null,
    googleCampaignName: body.name ? String(body.name) : undefined,
  });

  if (!record) {
    return NextResponse.json({ error: "Could not save the campaign" }, { status: 500 });
  }

  await logActivity(user.id, "info", `Campaign draft created (${goal})`, record.id);

  // Launch = push to Google. Only possible with the developer token.
  if (launch) {
    try {
      const token = await getValidAccessToken(user.id);
      const conn = await getConnection(user.id);
      if (!token || !conn?.google_customer_id) {
        await logActivity(user.id, "warning", "Launch skipped — connect Google Ads first", record.id);
        return NextResponse.json({
          ok: true,
          campaign: record,
          status: "draft",
          note: "Saved as a draft. Connect Google Ads and add the developer token to launch.",
        });
      }

      const { createGoogleAdsCampaign } = await import("@/lib/google-ads/client");
      const resourceName = await createGoogleAdsCampaign(token, conn.google_customer_id, {
        name: body.name ? String(body.name) : `Adswish ${goal} campaign`,
        dailyBudgetCents: dailyBudget,
        goal,
      });
      await stampGoogleCampaignId(user.id, record.id, resourceName.replace(/^customers\/\d+\/campaigns\//, ""));
      await logActivity(user.id, "success", "Campaign launched in Google Ads", record.id);
      return NextResponse.json({ ok: true, campaign: { ...record, status: "active" }, status: "active" });
    } catch (err) {
      const message =
        err instanceof GoogleAdsNotConfiguredError
          ? "Launch needs the Google Ads developer token (Ads API Center). Saved as a draft instead."
          : err instanceof Error ? err.message : "Google Ads launch failed";
      await logActivity(user.id, "warning", message, record.id);
      return NextResponse.json({ ok: true, campaign: record, status: "draft", note: message });
    }
  }

  return NextResponse.json({ ok: true, campaign: record, status: record.status });
}
