import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripeCurrency } from "@/lib/stripe/client";
import {
  evaluateFreePlanCampaignLimit,
  BUSINESS_PLAN_CAMPAIGN_LIMITS,
  FREE_PLAN_MONTHLY_LIMIT,
} from "@/lib/campaign-limits";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    title,
    description,
    type,
    commission_pct,
    fixed_amount,
    attribution_days,
    budget_cap,
    visibility,
    niche,
    deliverable_count,
    deliverable_deadlines,
    deadline_days,
    save_as_template,
    template_name,
    status,
    clone_from,
    hashtags,
    media_url,
    manual_review,
  } = body;

  // Duplicate an existing campaign: start from its settings, overridden by any
  // field explicitly supplied in this request.
  let base = {
    title,
    description: description ?? "",
    type,
    commission_pct: commission_pct ?? null,
    fixed_amount: fixed_amount ?? null,
    attribution_days: attribution_days ?? null,
    budget_cap: budget_cap ?? null,
    visibility: visibility ?? "public",
    niche: niche ?? [],
    deliverable_count,
    deadline_days: deadline_days ?? 14,
    hashtags: hashtags ?? {},
    media_url: media_url ?? null,
    manual_review: manual_review ?? false,
  };

  if (clone_from) {
    const { data: source } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", clone_from)
      .eq("business_id", user.id)
      .single();

    if (!source) {
      return NextResponse.json({ error: "Source campaign not found" }, { status: 404 });
    }

    base = {
      title: title ?? `${source.title} (copy)`,
      description: description ?? source.description,
      type: type ?? source.type,
      commission_pct: commission_pct ?? source.commission_pct,
      fixed_amount: fixed_amount ?? source.fixed_amount,
      attribution_days: attribution_days ?? source.attribution_days,
      budget_cap: budget_cap ?? source.budget_cap,
      visibility: visibility ?? source.visibility,
      niche: niche ?? source.niche,
      deliverable_count: deliverable_count ?? source.deliverable_count,
      deadline_days: deadline_days ?? source.deadline_days ?? 14,
      hashtags: hashtags ?? source.hashtags ?? {},
      media_url: media_url ?? source.media_url ?? null,
      manual_review: manual_review ?? source.manual_review ?? false,
    };
  }

  if (!base.title || !base.type || !base.deliverable_count) {
    return NextResponse.json({ error: "Missing required fields: title, type, deliverable_count" }, { status: 400 });
  }

  if (!["fixed", "affiliate", "hybrid"].includes(base.type)) {
    return NextResponse.json({ error: "Invalid campaign type" }, { status: 400 });
  }

  if ((base.type === "affiliate" || base.type === "hybrid") && !base.attribution_days) {
    return NextResponse.json({ error: "Affiliate/Hybrid campaigns require attribution_days (1-30)" }, { status: 400 });
  }

  if (base.type === "fixed" && !base.fixed_amount) {
    return NextResponse.json({ error: "Fixed campaigns require a fixed_amount" }, { status: 400 });
  }

  if ((base.type === "affiliate" || base.type === "hybrid") && !base.commission_pct) {
    return NextResponse.json({ error: "Affiliate/Hybrid campaigns require commission_pct" }, { status: 400 });
  }

  const { data: businessProfile } = await supabase
    .from("business_profiles")
    .select("user_id, company_name, campaigns_created_this_month, campaigns_created_month, account_status, stripe_customer_id, verified_domain, balance_cents")
    .eq("user_id", user.id)
    .single();

  if (!businessProfile) {
    return NextResponse.json({ error: "Business profile not found" }, { status: 404 });
  }

  if (businessProfile.account_status !== "active") {
    return NextResponse.json({ error: "Account is not active" }, { status: 403 });
  }

  // Tracking gating: a business has active tracking if its domain is verified
  // or it has at least one non-revoked tracking link.
  const { data: activeLinks } = await supabase
    .from("tracking_links")
    .select("id, campaigns!inner(business_id)")
    .eq("campaigns.business_id", user.id)
    .is("revoked_at", null)
    .limit(1);

  const hasStripe = Boolean(businessProfile.stripe_customer_id);
  const hasTracking = Boolean(businessProfile.verified_domain) || (activeLinks?.length ?? 0) > 0;

  // v3 onboarding gate: steps 1-4 (company info, domain/tracking, plan) must be
  // done before ANY campaign can be created. Stripe (step 5) stays optional and
  // is checked separately for affiliate/hybrid below.
  if (!businessProfile.company_name?.trim() || !hasTracking) {
    return NextResponse.json(
      {
        error:
          "Finish onboarding before creating campaigns: add your company info (Settings → Profile) and verify your domain / install tracking (Settings → Tracking).",
        code: "onboarding_incomplete",
      },
      { status: 403 },
    );
  }

  if ((base.type === "affiliate" || base.type === "hybrid") && (!hasStripe || !hasTracking)) {
    const missing = [];
    if (!hasStripe) missing.push("a connected Stripe payment method");
    if (!hasTracking) missing.push("an active tracking link or verified domain");
    return NextResponse.json(
      { error: `Affiliate/Hybrid campaigns require ${missing.join(" and ")}. Connect Stripe and set up tracking first.` },
      { status: 422 },
    );
  }

  if (base.type === "fixed" && !hasTracking) {
    // Without an active tracking link, fixed campaigns draw from the balance.
    const feeCents = Math.round((Number(base.fixed_amount) || 0) * 100);
    const balance = Number(businessProfile.balance_cents ?? 0);
    if (balance < feeCents) {
      return NextResponse.json(
        { error: `No active tracking link — a fixed campaign needs enough wallet balance (need ${(feeCents / 100).toFixed(2)}, have ${(balance / 100).toFixed(2)}). Top up first.` },
        { status: 422 },
      );
    }
  }

  const { data: subscription } = await supabase
    .from("business_subscriptions")
    .select("plan_slug")
    .eq("business_id", user.id)
    .eq("status", "active")
    .single();

  const planSlug = subscription?.plan_slug ?? "business_free";
  const planLimit = BUSINESS_PLAN_CAMPAIGN_LIMITS[planSlug] ?? FREE_PLAN_MONTHLY_LIMIT;
  const currentMonth = new Date().toISOString().slice(0, 7);

  if (status === "active") {
    const limit = evaluateFreePlanCampaignLimit(
      {
        campaigns_created_this_month: businessProfile.campaigns_created_this_month,
        campaigns_created_month: businessProfile.campaigns_created_month,
      },
      currentMonth,
      planLimit,
    );

    if (!limit.allowed) {
      const cap = Number.isFinite(planLimit) ? `${planLimit} campaigns per month` : "campaigns";
      return NextResponse.json(
        { error: `Your ${planSlug.replace("business_", "")} plan limit reached (${cap}). Upgrade for more.` },
        { status: 422 },
      );
    }

    await supabase
      .from("business_profiles")
      .update(limit.next)
      .eq("user_id", user.id);
  }

  // End date = latest deliverable deadline + 7 days.
  let endDate: string | null = null;
  if (deliverable_deadlines && deliverable_deadlines.length > 0) {
    endDate = new Date(
      Math.max(...deliverable_deadlines.map((d: string) => new Date(d).getTime())) +
        7 * 24 * 60 * 60 * 1000,
    ).toISOString();
  }

  // Derive the per-deliverable default deadline (in days) from the provided
  // deadlines so acceptance can stamp each creator's slots consistently.
  let resolvedDeadlineDays = base.deadline_days;
  if (deliverable_deadlines && deliverable_deadlines.length > 0) {
    const latest = Math.max(...deliverable_deadlines.map((d: string) => new Date(d).getTime()));
    resolvedDeadlineDays = Math.max(1, Math.round((latest - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      business_id: user.id,
      title: base.title,
      description: base.description,
      type: base.type,
      commission_pct: base.commission_pct,
      fixed_amount: base.fixed_amount,
      attribution_days: base.attribution_days,
      budget_cap: base.budget_cap,
      total_spent: 0,
      visibility: base.visibility,
      niche: base.niche,
      currency: getStripeCurrency().toUpperCase(),
      end_date: endDate,
      deliverable_count: base.deliverable_count,
      deadline_days: resolvedDeadlineDays,
      deliverable_deadlines: deliverable_deadlines ?? [],
      hashtags: base.hashtags,
      media_url: base.media_url,
      manual_review: base.manual_review,
      status: status || "draft",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // NOTE: deliverables are created per-creator when an application is
  // accepted (see /api/internal/applications), not at campaign creation — the
  // campaign only defines the count + default deadline.

  if (save_as_template && template_name) {
    await supabase.from("campaign_templates").insert({
      business_id: user.id,
      name: template_name,
      type: base.type,
      commission_pct: base.commission_pct,
      fixed_amount: base.fixed_amount,
      attribution_days: base.attribution_days,
      deliverable_count: base.deliverable_count,
      niche: base.niche,
    });
  }

  return NextResponse.json({ campaign });
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");

  if (role === "business") {
    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("business_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ campaigns });
  }

  if (role === "creator") {
    const q = searchParams.get("q");
    const type = searchParams.get("type");
    const minCommission = searchParams.get("min_commission");
    const maxCommission = searchParams.get("max_commission");
    const minRating = searchParams.get("min_rating");
    const attributionDays = searchParams.get("attribution_days");
    const niche = searchParams.get("niche");

    let query = supabase
      .from("campaigns")
      .select(`
        *,
        business_profiles!inner(company_name, logo_url, average_rating, verified_domain)
      `)
      .eq("visibility", "public")
      .in("status", ["active"])
      .is("deleted_at", null);

    if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    if (type) query = query.eq("type", type);
    if (minCommission) query = query.gte("commission_pct", Number(minCommission));
    if (maxCommission) query = query.lte("commission_pct", Number(maxCommission));
    if (minRating) query = query.gte("business_profiles.average_rating", Number(minRating));
    if (attributionDays) query = query.eq("attribution_days", Number(attributionDays));
    if (niche) query = query.overlaps("niche", [niche]);

    const { data: campaigns, error } = await query
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ campaigns });
  }

  return NextResponse.json({ error: "Invalid role" }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { campaign_id, action, pause_reason, pause_mode } = body;

  if (!campaign_id || !action) {
    return NextResponse.json({ error: "campaign_id and action are required" }, { status: 400 });
  }

  if (pause_mode && !["new_applications", "all_activity"].includes(pause_mode)) {
    return NextResponse.json({ error: "pause_mode must be new_applications or all_activity" }, { status: 400 });
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("business_id, status")
    .eq("id", campaign_id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (campaign.business_id !== user.id) {
    return NextResponse.json({ error: "Not your campaign" }, { status: 403 });
  }

  if (action === "pause") {
    if (campaign.status !== "active") {
      return NextResponse.json({ error: "Only active campaigns can be paused" }, { status: 422 });
    }

    // §12 granular pause: "new_applications" keeps existing creators' tracking
    // live; "all_activity" disables tracking links + new submissions.
    const mode = pause_mode === "new_applications" ? "new_applications" : "all_activity";
    const { error } = await supabase
      .from("campaigns")
      .update({
        status: "paused",
        pause_mode: mode,
        pause_reason: pause_reason || null,
        paused_at: new Date().toISOString(),
        paused_by: user.id,
      })
      .eq("id", campaign_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, status: "paused", pause_mode: mode });
  }

  if (action === "resume") {
    if (campaign.status !== "paused") {
      return NextResponse.json({ error: "Only paused campaigns can be resumed" }, { status: 422 });
    }

    const { error } = await supabase
      .from("campaigns")
      .update({
        status: "active",
        pause_mode: null,
        pause_reason: null,
        paused_at: null,
        paused_by: null,
      })
      .eq("id", campaign_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, status: "active" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
