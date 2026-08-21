import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getStripeClient, getStripeCurrency, calculateCreatorCut } from "@/lib/stripe/client";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import pino from "pino";

const logger = pino({ name: "finance" });

/** Minimum creator balance before a payout is issued, in dollars. */
export const MIN_PAYOUT_DOLLARS = 25;
export const MIN_PAYOUT_CENTS = MIN_PAYOUT_DOLLARS * 100;

// ---------------------------------------------------------------------------
// Pure money math (unit-testable, no I/O)
// ---------------------------------------------------------------------------

/**
 * Whether a creator is eligible for a payout: at/over the $25 minimum AND a
 * tax form (W-9/W-8BEN) has been approved.
 */
export function shouldPayout(balanceDollars: number, taxFormStatus: string): boolean {
  return balanceDollars >= MIN_PAYOUT_DOLLARS && taxFormStatus === "approved";
}

/** The profile shape the weekly payout job needs to decide eligibility. */
export interface WeeklyPayoutProfile {
  tax_form_status: string;
  stripe_account_id: string | null;
  stripe_connect_ready: boolean;
  payouts_paused_at: string | null;
}

/**
 * Whether the weekly payout job must skip a creator. A paused-payments account
 * is always blocked — even when otherwise fully eligible (tax form approved,
 * Connect ready, over the $25 minimum) — so no Stripe transfer is created
 * until an admin resumes payments.
 */
export function isWeeklyPayoutBlocked(
  profile: WeeklyPayoutProfile | null,
  totalDollars: number,
): boolean {
  if (!profile) return true;
  if (profile.payouts_paused_at) return true;
  if (!shouldPayout(totalDollars, profile.tax_form_status)) return true;
  if (!profile.stripe_account_id || !profile.stripe_connect_ready) return true;
  return false;
}

/**
 * Split a total order into the creator's kept portion and the business refund
 * when only some deliverables were approved. Mirrors the blueprint example:
 * $100 total, 2/3 deliverables approved -> creator keeps 2/3 (less the 10%
 * platform fee), business gets 1/3 back.
 *
 * Returns integer dollar amounts (rounded to cents).
 */
export function partialRefundSplit(
  totalDollars: number,
  approvedDeliverables: number,
  totalDeliverables: number,
): { creatorNetDollars: number; refundDollars: number } {
  if (totalDeliverables <= 0 || approvedDeliverables <= 0) {
    return { creatorNetDollars: 0, refundDollars: totalDollars };
  }
  if (approvedDeliverables >= totalDeliverables) {
    return { creatorNetDollars: calculateCreatorCut(totalDollars), refundDollars: 0 };
  }
  const creatorGross =
    Math.round(((totalDollars * approvedDeliverables) / totalDeliverables) * 100) / 100;
  const creatorNet = calculateCreatorCut(creatorGross);
  const refund = totalDollars - creatorGross;
  return { creatorNetDollars: creatorNet, refundDollars: refund };
}

// ---------------------------------------------------------------------------
// Webhook idempotency + retry/DLQ
// ---------------------------------------------------------------------------

/** Record a webhook event. Returns false when it was already processed. */
export async function recordWebhookEvent(
  eventId: string,
  provider: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("webhook_events")
    .insert({ event_id: eventId, provider, payload });
  if (error) {
    // 23505 = unique_violation on event_id primary key → already handled.
    if (error.code === "23505") return false;
    throw error;
  }
  return true;
}

/**
 * Track a failed delivery. Stripe retries on non-2xx responses; after 5
 * attempts we write to failed_jobs and stop letting the event fail forever.
 * Returns the new attempt count.
 */
export async function recordWebhookFailure(
  eventId: string,
  provider: string,
  payload: Record<string, unknown>,
  errorMessage: string,
): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("webhook_events")
    .select("attempt_count")
    .eq("event_id", eventId)
    .single();
  const attempts = (Number(data?.attempt_count) || 0) + 1;
  await supabase.from("webhook_events").update({ attempt_count: attempts }).eq("event_id", eventId);

  if (attempts >= 5) {
    await supabase.from("failed_jobs").insert({
      job_type: `stripe_webhook:${provider}`,
      payload: payload as Record<string, unknown>,
      error_message: errorMessage,
      attempt_count: attempts,
    });
  }
  return attempts;
}

// ---------------------------------------------------------------------------
// Conversion lifecycle (holds → release, refund, chargeback)
// ---------------------------------------------------------------------------

/** Release a single held conversion: mark released + write release/fee ledger entries + Stripe transfer. */
export async function releaseConversion(conversionId: string): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient();

  const { data: conversion } = await supabase
    .from("conversions")
    .select("id, creator_cut, platform_cut, tracking_link_id, stripe_transfer_id, status")
    .eq("id", conversionId)
    .single();

  if (!conversion || conversion.status !== "pending_hold") return false;

  const { data: link } = await supabase
    .from("tracking_links")
    .select("creator_id")
    .eq("id", conversion.tracking_link_id)
    .single();

  let transferId = conversion.stripe_transfer_id as string | null;
  if (!transferId && link?.creator_id) {
    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("stripe_account_id, stripe_connect_ready, payouts_paused_at")
      .eq("user_id", link.creator_id)
      .single();

    // Pause payments: the hold still releases (money is owed), but the Stripe
    // transfer is withheld until an admin resumes payouts.
    if (profile?.stripe_account_id && profile.stripe_connect_ready && !profile.payouts_paused_at) {
      try {
        const stripe = getStripeClient();
        const transfer = await stripe.transfers.create({
          amount: Math.round(Number(conversion.creator_cut) * 100),
          currency: getStripeCurrency(),
          destination: profile.stripe_account_id,
        });
        transferId = transfer.id;
      } catch (err) {
        logger.warn({ conversionId, err: String(err) }, "Stripe transfer failed; release recorded without transfer");
      }
    }
  }

  await supabase
    .from("conversions")
    .update({ status: "released", stripe_transfer_id: transferId ?? undefined })
    .eq("id", conversionId);

  await supabase.from("ledger_entries").insert([
    {
      related_conversion_id: conversionId,
      type: "release",
      amount: Number(conversion.creator_cut),
      stripe_transfer_id: transferId ?? undefined,
    },
    {
      related_conversion_id: conversionId,
      type: "platform_fee",
      amount: Number(conversion.platform_cut),
    },
  ]);

  return true;
}

// ---------------------------------------------------------------------------
// Checkout-time destination charge (90/10 split)
// ---------------------------------------------------------------------------

/**
 * Neutralize a conversion whose charge failed (declined card, 3DS challenge, or
 * missing payment method). Reverses the +creator_cut hold written at conversion
 * time and notifies the business. Idempotent: the `status = 'pending_hold'`
 * guard means whichever of the synchronous helper or the asynchronous
 * `payment_intent.payment_failed` webhook runs first wins, the other is a no-op.
 */
export async function markChargeFailed(
  conversionId: string,
  reason: string,
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient();

  const { data: conversion } = await supabase
    .from("conversions")
    .select("creator_cut, tracking_link_id")
    .eq("id", conversionId)
    .single();

  const { data: updated } = await supabase
    .from("conversions")
    .update({ status: "refunded" })
    .eq("id", conversionId)
    .eq("status", "pending_hold")
    .select("id");

  if (!updated || updated.length === 0) return; // already handled

  await supabase.from("ledger_entries").insert({
    related_conversion_id: conversionId,
    type: "refund",
    amount: -(Number(conversion?.creator_cut) || 0),
  });

  let businessId: string | null = null;
  if (conversion?.tracking_link_id) {
    const { data: link } = await supabase
      .from("tracking_links")
      .select("campaign_id")
      .eq("id", conversion.tracking_link_id)
      .single();
    if (link?.campaign_id) {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("business_id")
        .eq("id", link.campaign_id)
        .single();
      businessId = campaign?.business_id ?? null;
    }
  }

  if (businessId) {
    await supabase.from("notifications").insert({
      user_id: businessId,
      type: "payment",
      body: `A conversion charge failed and the hold was reversed: ${reason}`,
      link: "/dashboard/business/payments",
    });
  }

  logger.warn({ conversionId, reason }, "Destination charge failed; hold reversed and business notified");
}

// ---------------------------------------------------------------------------
// 3DS retry queue (requires_action / requires_confirmation off-session charges)
// ---------------------------------------------------------------------------

/**
 * Queue a charge that needs a customer-present step (3DS) so the business can
 * complete it later instead of the hold being reversed immediately. The 7-day
 * hold timer is paused (hold_expires_at = null) so the release job doesn't pay
 * out money that was never collected; the retry-expired cron reverses it only
 * after the window lapses.
 */
export async function queueRequiresActionCharge(
  conversionId: string,
  paymentIntentId: string,
  actionUrl: string | null,
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient();

  await supabase
    .from("conversions")
    .update({ hold_expires_at: null })
    .eq("id", conversionId)
    .eq("status", "pending_hold");

  await supabase.from("charge_retries").upsert(
    {
      conversion_id: conversionId,
      payment_intent_id: paymentIntentId,
      status: "pending",
      action_url: actionUrl,
      next_retry_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "conversion_id" },
  );

  // Resolve the business to notify (same chain as markChargeFailed).
  let businessId: string | null = null;
  const { data: conversion } = await supabase
    .from("conversions")
    .select("tracking_link_id")
    .eq("id", conversionId)
    .single();
  if (conversion?.tracking_link_id) {
    const { data: link } = await supabase
      .from("tracking_links")
      .select("campaign_id")
      .eq("id", conversion.tracking_link_id)
      .single();
    if (link?.campaign_id) {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("business_id")
        .eq("id", link.campaign_id)
        .single();
      businessId = campaign?.business_id ?? null;
    }
  }
  if (businessId) {
    await supabase.from("notifications").insert({
      user_id: businessId,
      type: "payment",
      body: actionUrl
        ? "A conversion charge needs you to complete 3-D Secure to finish. Complete it within 7 days or the hold is reversed."
        : "A conversion charge needs action (3-D Secure) before it completes. It is queued for 7 days.",
      link: actionUrl ?? "/dashboard/business/payments",
    });
  }

  logger.warn({ conversionId, paymentIntentId }, "Destination charge queued for 3DS completion");
}

/**
 * Job: advance the 3DS retry queue. Mark succeeded PIs complete; after 3
 * attempts (~72h) give up, reverse the hold and notify. Runs hourly with the
 * other crons.
 */
export async function retryExpiredCharges(now: Date = new Date()): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: retries } = await supabase
    .from("charge_retries")
    .select("conversion_id, payment_intent_id, attempts, next_retry_at")
    .eq("status", "pending")
    .lte("next_retry_at", now.toISOString());

  let handled = 0;
  const stripe = getStripeClient();
  for (const r of retries ?? []) {
    try {
      const pi = await stripe.paymentIntents.retrieve(r.payment_intent_id);
      if (pi.status === "succeeded") {
        await supabase
          .from("charge_retries")
          .update({ status: "completed" })
          .eq("conversion_id", r.conversion_id);
        handled++;
        continue;
      }
      if (r.attempts >= 3) {
        await markChargeFailed(
          r.conversion_id,
          "3-D Secure charge was not completed within the retry window.",
        );
        await supabase
          .from("charge_retries")
          .update({ status: "expired" })
          .eq("conversion_id", r.conversion_id);
        handled++;
        continue;
      }
      // Re-confirm is only meaningful for requires_confirmation (saved PM).
      if (pi.status === "requires_confirmation") {
        try {
          await stripe.paymentIntents.confirm(pi.id);
        } catch (err) {
          logger.warn({ pi: pi.id, err: String(err) }, "Charge retry confirm failed");
        }
      }
      await supabase
        .from("charge_retries")
        .update({
          attempts: (r.attempts || 0) + 1,
          next_retry_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("conversion_id", r.conversion_id);
      handled++;
    } catch (err) {
      logger.warn({ conversion_id: r.conversion_id, err: String(err) }, "Charge retry check failed");
    }
  }
  return handled;
}

/**
 * Charge the business's stored payment method for a conversion and put the
 * creator's 90% cut on hold. The creator transfer happens later on release
 * (releaseConversion), keeping the 7-day hold intact.
 *
 * Returns false when the business has no Stripe customer yet or the charge
 * failed — the conversion stays in pending_hold for a retry.
 */
export async function createDestinationChargeForConversion(conversionId: string): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient();

  const { data: conversion } = await supabase
    .from("conversions")
    .select("id, order_amount, creator_cut, tracking_link_id, stripe_payment_intent_id, status")
    .eq("id", conversionId)
    .single();

  if (!conversion || conversion.status !== "pending_hold") return false;
  if (conversion.stripe_payment_intent_id) return true; // already charged

  const { data: link } = await supabase
    .from("tracking_links")
    .select("campaign_id")
    .eq("id", conversion.tracking_link_id)
    .single();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("business_id")
    .eq("id", link?.campaign_id ?? "")
    .single();

  const { data: business } = await supabase
    .from("business_profiles")
    .select("stripe_customer_id, payouts_paused_at")
    .eq("user_id", campaign?.business_id ?? "")
    .single();

  // Pause payments: never charge a business whose payments are paused.
  if (business?.payouts_paused_at) {
    await markChargeFailed(conversionId, "Business payments are paused by an administrator.");
    return false;
  }

  if (!business?.stripe_customer_id) {
    await markChargeFailed(conversionId, "Business has no Stripe customer on file.");
    return false;
  }

  let paymentIntentId: string | null = null;
  try {
    const stripe = getStripeClient();
    // Off-session charges can't use automatic_payment_methods — Stripe rejects
    // them as "missing a payment method" because there's no customer present to
    // pick one. Resolve the customer's saved default method and pass it explicitly.
    const customer = await stripe.customers.retrieve(business.stripe_customer_id);
    const defaultPm =
      !customer.deleted &&
      (customer.invoice_settings?.default_payment_method as string | null);
    if (!defaultPm) {
      await markChargeFailed(
        conversionId,
        "Business has no default payment method saved in Stripe.",
      );
      return false;
    }

    const pi = await stripe.paymentIntents.create({
      amount: Math.round(Number(conversion.order_amount) * 100),
      currency: getStripeCurrency(),
      customer: business.stripe_customer_id,
      payment_method: defaultPm,
      confirm: true,
      off_session: true,
      metadata: { conversion_id: conversionId },
    });

    // 3DS / customer-present step: queue for later completion instead of
    // reversing the hold — the business gets a hosted action URL and the
    // charge-retries cron reverses the hold only if they abandon it.
    if (pi.status === "requires_action" || pi.status === "requires_confirmation") {
      const actionUrl =
        pi.next_action?.type === "redirect_to_url"
          ? (pi.next_action.redirect_to_url?.url ?? null)
          : null;
      await supabase
        .from("conversions")
        .update({ stripe_payment_intent_id: pi.id })
        .eq("id", conversionId);
      await queueRequiresActionCharge(conversionId, pi.id, actionUrl);
      return false;
    }

    // Any other non-succeeded status is a failed charge for our purposes:
    // reverse the hold and tell the business instead of leaving it pending.
    if (pi.status !== "succeeded") {
      await markChargeFailed(conversionId, `Charge not completed (status: ${pi.status}).`);
      return false;
    }
    paymentIntentId = pi.id;
  } catch (err) {
    const type = (err as { type?: string }).type;
    const declineCode = (err as { decline_code?: string }).decline_code;
    const message =
      type === "StripeCardError"
        ? `Card declined${declineCode ? ` (${declineCode})` : ""}.`
        : String(err);
    await markChargeFailed(conversionId, message);
    return false;
  }

  await supabase
    .from("conversions")
    .update({ stripe_payment_intent_id: paymentIntentId })
    .eq("id", conversionId);

  // No ledger write here: recordConversion already wrote the "hold" entry when
  // the conversion was created. This function only charges the business's card
  // and stamps the PaymentIntent id; the release/refund entries are written by
  // releaseConversion / applyRefund / applyChargeback.

  return true;
}

/** Job: release every conversion whose 7-day hold has expired. */
export async function releaseExpiredHolds(): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();
  const now = new Date().toISOString();

  const { data: conversions } = await supabase
    .from("conversions")
    .select("id")
    .eq("status", "pending_hold")
    .lte("hold_expires_at", now);

  let released = 0;
  for (const c of conversions ?? []) {
    if (await releaseConversion(c.id)) released++;
  }
  return released;
}

/** Refund part or all of a conversion (Stripe charge.refunded webhook). */
export async function applyRefund(conversionId: string, amountDollars: number): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: conversion } = await supabase
    .from("conversions")
    .select("id, order_amount, creator_cut, status")
    .eq("id", conversionId)
    .single();

  if (!conversion) return false;

  const orderAmount = Number(conversion.order_amount);
  const full = Math.abs(Math.abs(amountDollars) - orderAmount) < 0.01;
  // The hold was the creator's cut. Reverse that same proportion — a full
  // refund zeroes the hold, a partial refund zeroes the matching slice.
  const ratio = orderAmount > 0 ? Math.min(1, Math.abs(amountDollars) / orderAmount) : 1;
  const creatorRefund = Math.round(Number(conversion.creator_cut) * ratio * 100) / 100;

  await supabase
    .from("conversions")
    .update({ status: full ? "refunded" : "pending_hold" })
    .eq("id", conversionId);

  await supabase.from("ledger_entries").insert({
    related_conversion_id: conversionId,
    type: "refund",
    amount: -creatorRefund,
  });
  return true;
}

/** Reverse a conversion after a lost chargeback. */
export async function applyChargeback(conversionId: string, amountDollars: number): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: conversion } = await supabase
    .from("conversions")
    .select("id, creator_cut")
    .eq("id", conversionId)
    .single();

  await supabase
    .from("conversions")
    .update({ status: "chargeback" })
    .eq("id", conversionId);

  await supabase.from("ledger_entries").insert({
    related_conversion_id: conversionId,
    type: "chargeback_clawback",
    amount: -(Number(conversion?.creator_cut) || Math.abs(amountDollars)),
  });
  return true;
}

// ---------------------------------------------------------------------------
// Payouts + invoices
// ---------------------------------------------------------------------------

interface PendingConversion {
  id: string;
  creator_cut: number;
  payout_invoice_id: string | null;
  tracking_link_id: string;
  tracking_links: { creator_id: string } | { creator_id: string }[] | null;
}

function linkCreatorId(link: PendingConversion["tracking_links"]): string | null {
  if (!link) return null;
  return Array.isArray(link) ? (link[0]?.creator_id ?? null) : link.creator_id;
}

/**
 * Weekly payouts: group unreleased, unpaid conversions by creator. Creators who
 * meet the $25 minimum and have an approved tax form get a Stripe transfer and
 * an invoice row.
 */
export async function processWeeklyPayouts(): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();

  const { data: conversions } = await supabase
    .from("conversions")
    .select("id, creator_cut, payout_invoice_id, tracking_link_id, tracking_links(creator_id)")
    .eq("status", "released")
    .is("payout_invoice_id", null);

  const balances = new Map<string, { total: number; ids: string[] }>();
  for (const c of (conversions ?? []) as PendingConversion[]) {
    const creatorId = linkCreatorId(c.tracking_links);
    if (!creatorId) continue;
    const entry = balances.get(creatorId) ?? { total: 0, ids: [] };
    entry.total += Number(c.creator_cut);
    entry.ids.push(c.id);
    balances.set(creatorId, entry);
  }

  const weekStart = new Date();
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  let paidOut = 0;

  for (const [creatorId, entry] of balances.entries()) {
    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("tax_form_status, stripe_account_id, stripe_connect_ready, payouts_paused_at")
      .eq("user_id", creatorId)
      .single();

    if (isWeeklyPayoutBlocked(profile, entry.total)) {
      logger.info(
        { creatorId, total: entry.total },
        "Creator skipped: payments paused, below minimum, tax form not approved, or Connect not ready",
      );
      continue;
    }

    let transferId: string | null = null;
    try {
      const stripe = getStripeClient();
      const transfer = await stripe.transfers.create({
        amount: Math.round(entry.total * 100),
        currency: getStripeCurrency(),
        destination: profile.stripe_account_id,
      });
      transferId = transfer.id;
    } catch (err) {
      // Do not mark conversions as paid or create an invoice when Stripe did
      // not create the transfer. The next weekly run can retry safely.
      logger.warn({ creatorId, err: String(err) }, "Payout transfer failed; leaving earnings pending");
      continue;
    }

    const { data: invoice } = await supabase
      .from("payout_invoices")
      .insert({
        creator_id: creatorId,
        month_start: weekStart.toISOString().slice(0, 10),
        month_end: weekEnd.toISOString().slice(0, 10),
        total_released: entry.total,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (invoice?.id) {
      await supabase
        .from("conversions")
        .update({ payout_invoice_id: invoice.id })
        .in("id", entry.ids);
      paidOut++;
    }
  }

  return paidOut;
}

/** Monthly invoice generation for the previous calendar month (PDF is a stub for now). */
export async function generateMonthlyInvoices(): Promise<number> {
  const supabase = createSupabaseServiceRoleClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const { data: conversions } = await supabase
    .from("conversions")
    .select("creator_cut, tracking_link_id, tracking_links(creator_id)")
    .eq("status", "released")
    .gte("updated_at", monthStart.toISOString())
    .lte("updated_at", monthEnd.toISOString());

  const totals = new Map<string, number>();
  for (const c of (conversions ?? []) as PendingConversion[]) {
    const creatorId = linkCreatorId(c.tracking_links);
    if (!creatorId) continue;
    totals.set(creatorId, (totals.get(creatorId) ?? 0) + Number(c.creator_cut));
  }

  let generated = 0;
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const monthEndStr = monthEnd.toISOString().slice(0, 10);
  for (const [creatorId, total] of totals.entries()) {
    let pdfUrl: string | null = null;

    try {
      const { data: profile } = await supabase
        .from("creator_profiles")
        .select("display_name")
        .eq("user_id", creatorId)
        .single();

      const pdfBytes = await generateInvoicePdf({
        creatorName: profile?.display_name ?? "Creator",
        monthStart: monthStartStr,
        monthEnd: monthEndStr,
        totalReleased: total,
      });

      const path = `${creatorId}/${monthStartStr}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from("payout-invoices")
        .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });

      if (!uploadErr) {
        // Store the private bucket path. The download route turns it into a
        // short-lived signed URL for the owning creator.
        pdfUrl = path;
      } else if (uploadErr) {
        logger.warn({ creatorId, err: uploadErr.message }, "Invoice PDF upload failed");
      }
    } catch (err) {
      logger.warn({ creatorId, err: String(err) }, "Invoice PDF generation failed");
    }

    const { data: existing } = await supabase
      .from("payout_invoices")
      .select("id")
      .eq("creator_id", creatorId)
      .eq("month_start", monthStartStr)
      .single();

    const payload = {
      creator_id: creatorId,
      month_start: monthStartStr,
      month_end: monthEndStr,
      total_released: total,
      sent_at: new Date().toISOString(),
      pdf_url: pdfUrl,
    };

    if (existing?.id) {
      await supabase.from("payout_invoices").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("payout_invoices").insert(payload);
    }
    generated++;
  }
  return generated;
}
