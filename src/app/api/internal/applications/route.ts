import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { incrementCounter } from "@/lib/redis";
import { debitBalance } from "@/lib/balance";
import { CREATOR_PLAN_CAMPAIGN_LIMITS } from "@/lib/campaign-limits";
import { sendEmail, acceptedEmailHtml, campaignClosedEmailHtml } from "@/lib/email";
import {
  evaluateApply,
  nextApplicationStatus,
  buildDeliverableSlots,
  mapApplicationInsertError,
} from "@/lib/application-engine";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { campaign_id, cover_note } = body;

  if (!campaign_id) {
    return NextResponse.json({ error: "Missing campaign_id" }, { status: 400 });
  }

  // Gather every guard input, then delegate the decision to the pure engine.
  const [creatorProfile, campaign, creatorSub] = await Promise.all([
    supabase
      .from("creator_profiles")
      .select("tier, account_status, strikes")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("campaigns")
      .select("id, type, status, deliverable_count, deadline_days")
      .eq("id", campaign_id)
      .single(),
    supabase
      .from("creator_subscriptions")
      .select("plan_slug")
      .eq("creator_id", user.id)
      .eq("status", "active")
      .single(),
  ]);

  const { TIER_LIMITS } = await import("@/lib/tier");
  const tier = (creatorProfile?.data?.tier as "micro" | "mid" | "macro") ?? "micro";
  const tierConfig = TIER_LIMITS[tier];

  const isFree = !creatorSub?.data || creatorSub.data.plan_slug === "creator_free";
  const applyLimit = isFree ? 20 : 50;

  // Plan-based active-campaign cap (Free 2 / Pro 10 / Premium unlimited),
  // combined with the creator's tier cap so both constraints apply.
  const creatorPlanSlug = creatorSub?.data?.plan_slug ?? "creator_free";
  const planMaxActive = CREATOR_PLAN_CAMPAIGN_LIMITS[creatorPlanSlug] ?? 2;
  const maxActiveCampaigns = Math.min(tierConfig.maxActiveCampaigns, planMaxActive);

  const [existingApp, activeApps] = await Promise.all([
    supabase
      .from("applications")
      .select("id")
      .eq("campaign_id", campaign_id)
      .eq("creator_id", user.id)
      .single(),
    supabase
      .from("applications")
      .select("id")
      .eq("creator_id", user.id)
      .eq("status", "accepted"),
  ]);

  const decision = evaluateApply({
    profile: creatorProfile?.data
      ? {
          tier: creatorProfile.data.tier,
          account_status: creatorProfile.data.account_status,
          strikes: creatorProfile.data.strikes,
        }
      : null,
    campaign: campaign?.data
      ? {
          id: campaign.data.id,
          type: campaign.data.type,
          status: campaign.data.status,
          deliverable_count: campaign.data.deliverable_count,
          deadline_days: campaign.data.deadline_days,
        }
      : null,
    allowedCampaignTypes: [...tierConfig.campaignTypes] as Array<"fixed" | "affiliate" | "hybrid">,
    maxActiveCampaigns,
    existingApplication: Boolean(existingApp?.data),
    activeApplicationCount: activeApps?.data?.length ?? 0,
    applicationsLast24h: 0,
    applyLimit,
  });

  if (!decision.ok) {
    let message = decision.error ?? "Cannot apply";
    if (/Maximum active campaigns/i.test(message)) {
      message = `Maximum active campaigns reached (${maxActiveCampaigns}). Upgrade your plan for more.`;
    }
    return NextResponse.json({ error: message }, { status: decision.status });
  }

  // Rate-limit successful applies via Upstash (free tier, keys already set).
  // Counts near-successful applies so a rejected apply can't burn the budget.
  const applyCount = await incrementCounter({ key: `apply:${user.id}`, windowSeconds: 86400 });
  if (applyCount !== null && applyCount > applyLimit) {
    return NextResponse.json(
      { error: `Application rate limit reached (${applyLimit}/24h). Try again later.` },
      { status: 429 },
    );
  }

  const { data: application, error } = await supabase
    .from("applications")
    .insert({
      campaign_id,
      creator_id: user.id,
      status: "pending",
      cover_note: cover_note || null,
      tier_at_application: tier,
    })
    .select()
    .single();

  if (error) {
    const mapped = mapApplicationInsertError(error.code);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  const { data: campaign2 } = await supabase
    .from("campaigns")
    .select("business_id")
    .eq("id", campaign_id)
    .single();

  if (campaign2) {
    await supabase.from("notifications").insert({
      user_id: campaign2.business_id,
      type: "application",
      body: "New application received on your campaign.",
      link: `/dashboard/business/campaigns/${campaign_id}`,
    });
  }

  return NextResponse.json({ application });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { application_id, action } = body;

  if (!application_id || !action) {
    return NextResponse.json({ error: "Missing application_id or action" }, { status: 400 });
  }

  const { data: application } = await supabase
    .from("applications")
    .select("*, campaigns!inner(business_id)")
    .eq("id", application_id)
    .single();

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (action === "accept" || action === "reject") {
    if (application.campaigns.business_id !== user.id) {
      return NextResponse.json({ error: "Only the business owner can accept/reject" }, { status: 403 });
    }

    // Only pending applications can be accepted/rejected.
    const newStatus = nextApplicationStatus(application.status, action);
    if (!newStatus) {
      return NextResponse.json(
        { error: `Cannot ${action} an application in status: ${application.status}` },
        { status: 422 },
      );
    }

    let campaignForAccept: any = null;

    if (action === "accept") {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("id, type, fixed_amount, business_id, title, deliverable_count, deadline_days, deliverable_deadlines")
        .eq("id", application.campaign_id)
        .single();
      campaignForAccept = campaign;

      // Fixed campaigns are funded from the business's pre-paid balance.
      if (campaign?.type === "fixed") {
        const fee = Math.round((Number(campaign.fixed_amount) || 0) * 100);
        if (fee > 0) {
          const service = createSupabaseServiceRoleClient();
          const debit = await debitBalance(
            service,
            campaign.business_id,
            fee,
            "campaign_spend",
            `Fixed campaign: ${campaign.title}`,
            campaign.id,
          );

          if (!debit.ok) {
            // Insufficient balance → close the campaign and notify everyone.
            await service.from("campaigns").update({ status: "closed" }).eq("id", campaign.id);

            const { data: applicants } = await service
              .from("applications")
              .select("creator_id")
              .eq("campaign_id", campaign.id);
            for (const a of applicants ?? []) {
              await service.from("notifications").insert({
                user_id: a.creator_id,
                type: "application",
                body: "A campaign you applied to was closed — the business had insufficient balance.",
                link: "/dashboard/creator/discover",
              });
            }

            await service.from("notifications").insert({
              user_id: campaign.business_id,
              type: "payment",
              body: `Campaign "${campaign.title}" was closed: insufficient balance for the fixed payout.`,
              link: `/dashboard/business/campaigns/${campaign.id}`,
            });

            if (user.email) {
              sendEmail({
                to: user.email,
                subject: "Your campaign was closed — insufficient balance",
                text: `Campaign "${campaign.title}" was closed because your balance did not cover the fixed payout. Top up your balance and re-open the campaign to continue.`,
                html: campaignClosedEmailHtml(
                  campaign.title,
                  `${new URL(request.url).origin}/dashboard/business/payments`,
                ),
              }).catch(() => {});
            }

            return NextResponse.json(
              { error: "Insufficient balance for this fixed campaign. The campaign has been closed." },
              { status: 402 },
            );
          }
        }
      }
    }

    const { error } = await supabase
      .from("applications")
      .update({ status: newStatus, decided_at: new Date().toISOString() })
      .eq("id", application_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (action === "accept") {
      const campaign = campaignForAccept;

      if (campaign) {
        const deliverables = buildDeliverableSlots(
          {
            id: campaign.id,
            deliverable_count: campaign.deliverable_count,
            deadline_days: campaign.deadline_days,
            deliverable_deadlines: campaign.deliverable_deadlines,
          },
          application.creator_id,
        );
        await supabase.from("deliverables").insert(deliverables);
      }

      await supabase.from("notifications").insert({
        user_id: application.creator_id,
        type: "application",
        body: "Your application was accepted! Deliverables are now unlocked.",
        link: `/dashboard/creator/campaigns/${application.campaign_id}`,
      });

      // Email the accepted creator (best-effort).
      try {
        const { data: creatorUser } = await createSupabaseServiceRoleClient().auth.admin.getUserById(
          application.creator_id,
        );
        if (creatorUser?.user?.email) {
          sendEmail({
            to: creatorUser.user.email,
            subject: "You've been accepted on Adswish 🎉",
            text: "Good news — your application was accepted. Your deliverables are now unlocked in your dashboard. Log in to get started.",
            html: acceptedEmailHtml(`${new URL(request.url).origin}/dashboard/creator/campaigns`),
          }).catch(() => {});
        }
      } catch {
        // email is best-effort; never fail the accept over it
      }
    } else {
      await supabase.from("notifications").insert({
        user_id: application.creator_id,
        type: "application",
        body: "Your application was not accepted for this campaign.",
        link: `/dashboard/creator/discover`,
      });
    }

    return NextResponse.json({ success: true, status: newStatus });
  }

  if (action === "withdraw") {
    if (application.creator_id !== user.id) {
      return NextResponse.json({ error: "Only the creator can withdraw" }, { status: 403 });
    }

    const newStatus = nextApplicationStatus(application.status, "withdraw");
    if (!newStatus) {
      return NextResponse.json(
        { error: `Cannot withdraw an application in status: ${application.status}` },
        { status: 422 },
      );
    }

    const { error } = await supabase
      .from("applications")
      .update({ status: newStatus, withdrawn_at: new Date().toISOString() })
      .eq("id", application_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, status: newStatus });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
