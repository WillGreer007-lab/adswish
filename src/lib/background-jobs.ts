import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/admin/audit-log";
import { markJtiRevoked } from "@/lib/redis";
import pino from "pino";

const logger = pino({ name: "background-jobs" });

export async function checkDeliverableDeadlines(now: Date = new Date()) {
  const supabase = createSupabaseServiceRoleClient();
  const nowIso = now.toISOString();

  const { data: overdueDeliverables, error } = await supabase
    .from("deliverables")
    .select("id, campaign_id, creator_id, deadline_date, submitted_url, grace_period_task_id")
    .lt("deadline_date", nowIso)
    .eq("status", "pending")
    .is("deleted_at", null);

  if (error) {
    logger.error({ error: error.message }, "Failed to fetch overdue deliverables");
    return;
  }

  if (!overdueDeliverables || overdueDeliverables.length === 0) {
    return;
  }

  for (const d of overdueDeliverables) {
    if (d.submitted_url) {
      await supabase
        .from("deliverables")
        .update({ status: "pending_business_review" })
        .eq("id", d.id);
    } else {
      const graceEnds = new Date(new Date(d.deadline_date).getTime() + 24 * 60 * 60 * 1000);

      if (now > graceEnds) {
        await supabase
          .from("deliverables")
          .update({ status: "kicked" })
          .eq("id", d.id);

        await supabase.from("notifications").insert({
          user_id: d.creator_id,
          type: "sla",
          body: "Your deliverable has been kicked for missing the deadline.",
          link: `/dashboard/creator/campaigns/${d.campaign_id}`,
        });

        logger.info({ deliverable_id: d.id }, "Deliverable kicked after grace period");
      } else {
        await supabase
          .from("deliverables")
          .update({ status: "grace_period" })
          .eq("id", d.id);

        if (!d.grace_period_task_id) {
          await supabase.from("notifications").insert({
            user_id: d.creator_id,
            type: "sla",
            body: "A deliverable deadline has passed. You have 24 hours to submit before being kicked.",
            link: `/dashboard/creator/campaigns/${d.campaign_id}`,
          });
        }
      }
    }
  }
}

export async function checkSLADisputes(now: Date = new Date()) {
  const supabase = createSupabaseServiceRoleClient();
  const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();

  const { data: expiredDisputes, error } = await supabase
    .from("sla_disputes")
    .select("id, raised_by, related_deliverable_id, related_conversion_id")
    .eq("status", "open")
    .lt("opened_at", seventyTwoHoursAgo);

  if (error) {
    logger.error({ error: error.message }, "Failed to fetch expired SLA disputes");
    return;
  }

  if (!expiredDisputes || expiredDisputes.length === 0) {
    return;
  }

  for (const dispute of expiredDisputes) {
    await supabase
      .from("sla_disputes")
      .update({
        status: "resolved",
        resolution: "dismissed",
        resolved_at: now.toISOString(),
      })
      .eq("id", dispute.id);

    // Locate the business at fault via the disputed deliverable/conversion.
    let campaignId: string | null = null;
    if (dispute.related_deliverable_id) {
      const { data: deliverable } = await supabase
        .from("deliverables")
        .select("campaign_id")
        .eq("id", dispute.related_deliverable_id)
        .single();
      campaignId = deliverable?.campaign_id ?? null;
    } else if (dispute.related_conversion_id) {
      const { data: conversion } = await supabase
        .from("conversions")
        .select("tracking_link_id")
        .eq("id", dispute.related_conversion_id)
        .single();
      if (conversion?.tracking_link_id) {
        const { data: link } = await supabase
          .from("tracking_links")
          .select("campaign_id")
          .eq("id", conversion.tracking_link_id)
          .single();
        campaignId = link?.campaign_id ?? null;
      }
    }

    if (campaignId) {
      // Unresolved SLA → auto-drop campaign, disable tracking, free creator,
      // and hand the business a strike (blueprint §12).
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("business_id, status")
        .eq("id", campaignId)
        .single();

      if (campaign) {
        if (campaign.status === "active" || campaign.status === "paused") {
          await supabase.from("campaigns").update({ status: "cancelled" }).eq("id", campaignId);
        }

        // Revoke the campaign's live tracking links and blocklist their jtis
        // (Postgres source of truth + Redis fast path, blueprint §11).
        const { data: links } = await supabase
          .from("tracking_links")
          .select("id, jti")
          .eq("campaign_id", campaignId)
          .is("revoked_at", null);

        for (const l of links ?? []) {
          if (l.jti) {
            await markJtiRevoked(l.jti);
            await supabase.from("revoked_jtis").upsert(
              { jti: l.jti, reason: "sla_auto_drop" },
              { onConflict: "jti" },
            );
          }
        }

        await supabase
          .from("tracking_links")
          .update({ revoked_at: now.toISOString() })
          .eq("campaign_id", campaignId)
          .is("revoked_at", null);

        await supabase
          .from("deliverables")
          .update({ status: "auto_dropped_sla" })
          .eq("campaign_id", campaignId)
          .in("status", ["pending", "grace_period", "pending_business_review"]);

        const { data: profile } = await supabase
          .from("business_profiles")
          .select("strikes")
          .eq("user_id", campaign.business_id)
          .single();

        if (profile) {
          const newStrikes = (profile.strikes || 0) + 1;
          await supabase
            .from("business_profiles")
            .update({
              strikes: newStrikes,
              account_status: newStrikes >= 3 ? "banned" : "active",
            })
            .eq("user_id", campaign.business_id);

          if (newStrikes >= 3) {
            await logAdminAction({
              adminId: "system",
              actionType: "ban_user",
              targetEntityId: campaign.business_id,
              metadata: { reason: "3-strike auto-ban", dispute_id: dispute.id },
            });
          }
        }

        await supabase.from("notifications").insert({
          user_id: campaign.business_id,
          type: "sla",
          body: "An SLA dispute was auto-resolved: the campaign was dropped and your account received a strike.",
          link: `/dashboard/business/campaigns/${campaignId}`,
        });
      }
    }

    logger.info({ dispute_id: dispute.id }, "SLA dispute auto-resolved after 72 hours");
  }
}

export async function checkSubscriptionDunning() {
  const supabase = createSupabaseServiceRoleClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: pastDue } = await supabase
    .from("creator_subscriptions")
    .select("creator_id, plan_slug, status, current_period_end")
    .eq("status", "past_due")
    .lt("current_period_end", sevenDaysAgo);

  if (pastDue) {
    for (const sub of pastDue) {
      await supabase
        .from("creator_subscriptions")
        .update({ plan_slug: "creator_free", status: "active" })
        .eq("creator_id", sub.creator_id);

      await supabase.from("notifications").insert({
        user_id: sub.creator_id,
        type: "system",
        body: "Your subscription has been downgraded to Free after 7 days of failed payment.",
        link: "/dashboard",
      });
    }
  }

  const { data: pastDueBusiness } = await supabase
    .from("business_subscriptions")
    .select("business_id, plan_slug, status, current_period_end")
    .eq("status", "past_due")
    .lt("current_period_end", sevenDaysAgo);

  if (pastDueBusiness) {
    for (const sub of pastDueBusiness) {
      await supabase
        .from("business_subscriptions")
        .update({ plan_slug: "business_free", status: "active" })
        .eq("business_id", sub.business_id);

      await supabase.from("notifications").insert({
        user_id: sub.business_id,
        type: "system",
        body: "Your subscription has been downgraded to Free after 7 days of failed payment.",
        link: "/dashboard",
      });
    }
  }
}

export async function checkPixelPenalty(now: Date = new Date()) {
  const supabase = createSupabaseServiceRoleClient();
  const cutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, business_id, title, last_pixel_ping_at, offline_warning_sent_at, pixel_offline_at")
    .in("type", ["affiliate", "hybrid"])
    .eq("status", "active")
    .eq("pixel_status", "active");

  if (error) {
    logger.error({ error: error.message }, "Failed to fetch pixel status");
    return;
  }

  for (const c of campaigns ?? []) {
    const stale = !c.last_pixel_ping_at || new Date(c.last_pixel_ping_at) < cutoff;
    if (!stale) continue;

    const nowIso = now.toISOString();

    // Preserve the original offline timestamp for the 30-day badge.
    await supabase
      .from("campaigns")
      .update({ pixel_status: "offline", pixel_offline_at: c.pixel_offline_at ?? nowIso })
      .eq("id", c.id);

    if (!c.offline_warning_sent_at) {
      // First detection: alert the business + affected creators (§12).
      await supabase
        .from("campaigns")
        .update({ offline_warning_sent_at: nowIso })
        .eq("id", c.id);

      await supabase.from("notifications").insert({
        user_id: c.business_id,
        type: "pixel_offline",
        body: `Your tracking pixel for "${c.title}" is offline. Restore it within 12 hours to avoid suspension.`,
        link: `/dashboard/business/campaigns/${c.id}`,
      });

      const { data: activeDeliverables } = await supabase
        .from("deliverables")
        .select("creator_id")
        .eq("campaign_id", c.id)
        .in("status", ["pending", "grace_period", "pending_business_review"]);

      for (const d of activeDeliverables ?? []) {
        await supabase.from("notifications").insert({
          user_id: d.creator_id,
          type: "pixel_offline",
          body: `The tracking pixel for a campaign you're on went offline. Attribution may be paused.`,
          link: `/dashboard/creator/campaigns/${c.id}`,
        });
      }

      logger.warn({ campaign_id: c.id }, "Pixel went offline; warning sent");
    } else {
      // Still offline after the warning window → domain-scoped suspension
      // (v1: single verified_domain per business). Fixed-fee unaffected — we
      // only ever query Affiliate/Hybrid above.
      await supabase
        .from("campaigns")
        .update({
          status: "paused",
          pause_mode: "all_activity",
          pause_reason: "pixel_offline",
          paused_at: nowIso,
        })
        .eq("id", c.id);

      await supabase.from("notifications").insert({
        user_id: c.business_id,
        type: "pixel_offline",
        body: `Campaign "${c.title}" was suspended: the tracking pixel stayed offline for over 12 hours.`,
        link: `/dashboard/business/campaigns/${c.id}`,
      });

      logger.warn({ campaign_id: c.id }, "Pixel offline >12h: campaign suspended");
    }
  }
}

/**
 * Materialize the previous UTC day's clicks and conversions for the analytics
 * dashboards. The job is intentionally idempotent: rerunning the same day
 * replaces the rollup row rather than double-counting it.
 */
export async function aggregateDailyRollups(day: Date = new Date(Date.now() - 24 * 60 * 60 * 1000)): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const date = start.toISOString().slice(0, 10);

  type ClickRow = { tracking_link_id: string };
  type ConversionRollupRow = {
    tracking_link_id: string;
    order_amount: number | string | null;
    creator_cut: number | string | null;
    platform_cut: number | string | null;
  };
  type LinkRow = { id: string; campaign_id: string; creator_id: string };

  const [{ data: clicks }, { data: conversions }] = await Promise.all([
    supabase
      .from("clicks_log")
      .select("tracking_link_id")
      .gte("clicked_at", start.toISOString())
      .lt("clicked_at", end.toISOString()),
    supabase
      .from("conversions")
      .select("tracking_link_id, order_amount, creator_cut, platform_cut")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString()),
  ]);

  const clickRows = (clicks ?? []) as ClickRow[];
  const conversionRows = (conversions ?? []) as ConversionRollupRow[];
  const linkIds = [
    ...new Set([
      ...clickRows.map((row) => row.tracking_link_id),
      ...conversionRows.map((row) => row.tracking_link_id),
    ]),
  ];
  const { data: links } = linkIds.length
    ? await supabase.from("tracking_links").select("id, campaign_id, creator_id").in("id", linkIds)
    : { data: [] };
  const linkRows = (links ?? []) as LinkRow[];
  const linkMap = new Map(linkRows.map((link) => [link.id, link]));

  const totals = new Map<string, {
    campaign_id: string;
    creator_id: string;
    total_clicks: number;
    total_conversions: number;
    gross_sales: number;
    creator_cut: number;
    platform_cut: number;
  }>();

  function bucket(linkId: string) {
    const link = linkMap.get(linkId);
    if (!link) return null;
    const key = `${link.campaign_id}:${link.creator_id}`;
    const current = totals.get(key) ?? {
      campaign_id: link.campaign_id,
      creator_id: link.creator_id,
      total_clicks: 0,
      total_conversions: 0,
      gross_sales: 0,
      creator_cut: 0,
      platform_cut: 0,
    };
    totals.set(key, current);
    return current;
  }

  for (const click of clickRows) {
    const current = bucket(click.tracking_link_id);
    if (current) current.total_clicks += 1;
  }

  for (const conversion of conversionRows) {
    const current = bucket(conversion.tracking_link_id);
    if (!current) continue;
    current.total_conversions += 1;
    current.gross_sales += Number(conversion.order_amount ?? 0);
    current.creator_cut += Number(conversion.creator_cut ?? 0);
    current.platform_cut += Number(conversion.platform_cut ?? 0);
  }

  const rows = [...totals.values()].map((row) => ({ ...row, date }));
  if (!rows.length) return 0;

  const { error } = await supabase
    .from("daily_conversion_rollups")
    .upsert(rows, { onConflict: "campaign_id,creator_id,date" });
  if (error) {
    logger.error({ error: error.message, date }, "Failed to write daily analytics rollups");
    throw error;
  }
  return rows.length;
}

/**
 * Recompute all creator + business badges (blue/gold per spec §24, mirrored
 * for businesses). Catches badge drift from social connects, manual
 * approvals, subscription changes, and domain verification.
 */
export async function refreshAllBadges(): Promise<number> {
  const { refreshAllCreatorBadges, refreshAllBusinessBadges } = await import("@/lib/badges");
  const creators = await refreshAllCreatorBadges();
  const businesses = await refreshAllBusinessBadges();
  return creators + businesses;
}

/**
 * Google Ads: mirror live campaign statuses into google_ads_campaigns. Only
 * runs for connections that have a customer id; without the developer token
 * the live calls throw and the job skips that connection gracefully.
 */
export async function syncGoogleAdsCampaigns(): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: connections } = await supabase
    .from("google_ads_connections")
    .select("user_id, google_customer_id")
    .eq("status", "active")
    .not("google_customer_id", "is", null);

  let synced = 0;
  for (const conn of connections ?? []) {
    try {
      const { getValidAccessToken } = await import("@/lib/google-ads/connection");
      const { listCampaigns } = await import("@/lib/google-ads/client");
      const token = await getValidAccessToken(conn.user_id);
      if (!token) continue;
      const campaigns = await listCampaigns(token, conn.google_customer_id);

      for (const c of campaigns) {
        const status = c.status.toLowerCase();
        const recordStatus = status === "enabled" ? "active" : status === "paused" ? "paused" : "removed";
        const { data: existing } = await supabase
          .from("google_ads_campaigns")
          .select("id")
          .eq("user_id", conn.user_id)
          .eq("google_campaign_id", c.id)
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from("google_ads_campaigns")
            .update({
              status: recordStatus,
              google_campaign_name: c.name,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("google_ads_campaigns").insert({
            user_id: conn.user_id,
            google_campaign_id: c.id,
            google_campaign_name: c.name,
            status: recordStatus,
            last_synced_at: new Date().toISOString(),
          });
        }
        synced++;
      }
    } catch (err) {
      logger.warn({ user_id: conn.user_id, err: String(err) }, "Google Ads sync skipped (developer token or API error)");
    }
  }
  return synced;
}

/**
 * Google Ads reporting sync: pull real spend/revenue/conversions per campaign
 * from the Ads API and store them on the local records (feeds the blended ROAS
 * charts and the kill switch). Requires the developer token — without it the
 * job skips every connection cleanly and charts stay honest zeros.
 */
export async function syncGoogleAdsReporting(): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: connections } = await supabase
    .from("google_ads_connections")
    .select("user_id, google_customer_id")
    .eq("status", "active")
    .not("google_customer_id", "is", null);

  let synced = 0;
  for (const conn of connections ?? []) {
    try {
      const { getValidAccessToken } = await import("@/lib/google-ads/connection");
      const { listCampaignMetrics } = await import("@/lib/google-ads/client");
      const token = await getValidAccessToken(conn.user_id);
      if (!token) continue;

      const metrics = await listCampaignMetrics(token, conn.google_customer_id);
      for (const m of metrics) {
        const { data: existing } = await supabase
          .from("google_ads_campaigns")
          .select("id")
          .eq("user_id", conn.user_id)
          .eq("google_campaign_id", m.id)
          .maybeSingle();
        if (!existing?.id) continue;
        await supabase
          .from("google_ads_campaigns")
          .update({
            total_spend_cents: m.spendCents,
            revenue_cents: m.revenueCents,
            conversions: m.conversions,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        synced++;
      }
    } catch (err) {
      logger.warn(
        { user_id: conn.user_id, err: String(err) },
        "Google Ads reporting sync skipped (developer token or API error)",
      );
    }
  }
  return synced;
}

/**
 * Google Ads budget protection: pause campaigns whose local spend/revenue
 * breaches the user's kill-switch thresholds. Spend data only exists once the
 * reporting sync runs (needs the developer token), so this is inert until then
 * — it never pauses on zero data.
 */
export async function runGoogleAdsKillSwitch(): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: connections } = await supabase
    .from("google_ads_connections")
    .select("user_id, google_customer_id, kill_switch")
    .eq("status", "active");

  let paused = 0;
  for (const conn of connections ?? []) {
    const ks = (conn.kill_switch ?? {}) as {
      maxDaily?: number;
      maxTotal?: number;
      minConversions?: number;
      minRoas?: number;
    };
    if (!ks.maxTotal && !ks.maxDaily && !ks.minRoas && !ks.minConversions) continue;

    const { data: campaigns } = await supabase
      .from("google_ads_campaigns")
      .select("id, google_campaign_id, status, total_spend_cents, revenue_cents, conversions, daily_budget_cents")
      .eq("user_id", conn.user_id)
      .in("status", ["active", "pending"]);

    for (const c of campaigns ?? []) {
      const spend = Number(c.total_spend_cents) || 0;
      const revenue = Number(c.revenue_cents) || 0;
      const conversions = Number(c.conversions) || 0;
      const maxTotalCents = ks.maxTotal ? Math.round(ks.maxTotal * 100) : Infinity;
      const maxDailyCents = ks.maxDaily ? Math.round(ks.maxDaily * 100) : Infinity;
      const roas = spend > 0 ? revenue / spend : null;
      const enoughConversions = conversions >= (ks.minConversions ?? 0);

      const breached =
        enoughConversions &&
        (spend >= maxTotalCents ||
          (Number.isFinite(maxDailyCents) && Number(c.daily_budget_cents) > 0 && spend >= maxDailyCents) ||
          (typeof ks.minRoas === "number" && roas !== null && roas < ks.minRoas));

      if (!breached) continue;

      let note = "Paused automatically — budget protection triggered.";
      if (c.google_campaign_id) {
        try {
          const { getValidAccessToken } = await import("@/lib/google-ads/connection");
          const { updateGoogleAdsCampaignStatus } = await import("@/lib/google-ads/client");
          const token = await getValidAccessToken(conn.user_id);
          if (token && conn.google_customer_id) {
            await updateGoogleAdsCampaignStatus(token, conn.google_customer_id, c.google_campaign_id, "PAUSED");
            note = "Paused in Google Ads — budget protection triggered.";
          }
        } catch {
          /* keep the local pause even if the live pause fails */
        }
      }

      await supabase
        .from("google_ads_campaigns")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("id", c.id);
      await supabase.from("google_ads_activity_log").insert({
        user_id: conn.user_id,
        campaign_id: c.id,
        kind: "warning",
        message: note,
      });
      await supabase.from("notifications").insert({
        user_id: conn.user_id,
        type: "system",
        body: "A Google Ads campaign was auto-paused — budget protection triggered.",
        link: "/dashboard/business/google-ads",
      });
      paused++;
    }
  }
  return paused;
}

/**
 * Google Ads A/B thumbnails: auto-extract three thumbnail frames from freshly
 * approved deliverables that don't have assets yet. Runs every cron tick;
 * gracefully skips rows whose video is missing or unprocessable.
 */
export async function generateGoogleAdsThumbnails(): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();

  type DeliverableRow = {
    id: string;
    campaign_id: string;
    video_url: string | null;
    campaigns: { business_id: string } | null;
  };
  const { data: candidates } = await supabase
    .from("deliverables")
    .select("id, campaign_id, video_url, campaigns(business_id)")
    .eq("status", "completed") // approval stamps `completed` (see approve route)
    .not("video_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(25);

  let generated = 0;
  for (const row of (candidates ?? []) as DeliverableRow[]) {
    if (!row.video_url || !row.campaigns?.business_id) continue;

    // Skip deliverables that already have assets (any status) — regeneration
    // is only triggered from the UI.
    const { count } = await supabase
      .from("deliverable_ab_assets")
      .select("*", { count: "exact", head: true })
      .eq("deliverable_id", row.id);
    if (count) continue;

    try {
      const { generateDeliverableThumbnails } = await import("@/lib/google-ads/thumbnails");
      const result = await generateDeliverableThumbnails(
        { id: row.id, campaign_id: row.campaign_id, video_url: row.video_url },
        row.campaigns.business_id,
      );
      generated += result.generated;
      if (result.failed) {
        logger.warn(
          { deliverable_id: row.id, error: result.error },
          "A/B thumbnail generation failed",
        );
      }
    } catch (err) {
      logger.warn(
        { deliverable_id: row.id, err: String(err) },
        "A/B thumbnail job skipped a deliverable",
      );
    }
  }
  return generated;
}

export async function checkCampaignCompletion() {
  const supabase = createSupabaseServiceRoleClient();

  const { data: activeCampaigns } = await supabase
    .from("campaigns")
    .select("id")
    .eq("status", "active")
    .is("deleted_at", null);

  if (!activeCampaigns) return;

  for (const campaign of activeCampaigns) {
    const { count: pendingDeliverables } = await supabase
      .from("deliverables")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .not("status", "in", '("completed","kicked","dropped_by_business","auto_dropped_sla")');

    if (pendingDeliverables === 0) {
      await supabase
        .from("campaigns")
        .update({ status: "completed" })
        .eq("id", campaign.id);

      logger.info({ campaign_id: campaign.id }, "Campaign auto-completed");
    }
  }
}
