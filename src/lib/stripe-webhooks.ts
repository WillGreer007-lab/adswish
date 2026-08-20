import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripeClient } from "@/lib/stripe/client";
import { escrowHoldExpiresAt, escrowHoldDaysForPlan, ESCROW_HOLD_DAYS } from "@/lib/payout-math";
import { applyRefund, applyChargeback, markChargeFailed } from "@/lib/finance";
import { creditBalance } from "@/lib/balance";
import pino from "pino";

const logger = pino({ name: "stripe-webhooks" });

/** Map a Stripe subscription status to the app's allowed status enum. */
export function mapSubscriptionStatus(
  status: Stripe.Subscription.Status,
): "active" | "past_due" | "canceled" | "trialing" {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    default:
      return "canceled";
  }
}

interface SubscriptionMeta {
  user_id?: string;
  role?: string;
  plan_slug?: string;
}

/**
 * Sync a Stripe subscription object into the correct subscription table.
 * Resolves the owner from the subscription metadata first, then falls back to
 * the customer's stripe_customer_id.
 */
export async function syncSubscription(
  subscription: Stripe.Subscription,
  supabase: SupabaseClient,
): Promise<void> {
  const meta = (subscription.metadata ?? {}) as SubscriptionMeta;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;

  let userId: string | null = meta.user_id ?? null;
  let role: string | null = meta.role ?? null;

  if (!userId && customerId) {
    const { data: business } = await supabase
      .from("business_profiles")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .single();
    if (business?.user_id) {
      userId = business.user_id;
      role = "business";
    } else {
      const { data: creator } = await supabase
        .from("creator_profiles")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .single();
      if (creator?.user_id) {
        userId = creator.user_id;
        role = "creator";
      }
    }
  }

  if (!userId) {
    logger.warn({ subscription_id: subscription.id }, "Could not resolve subscription owner");
    return;
  }

  const table = role === "business" ? "business_subscriptions" : "creator_subscriptions";
  const idColumn = role === "business" ? "business_id" : "creator_id";
  const status = mapSubscriptionStatus(subscription.status);

  const payload: Record<string, unknown> = {
    [idColumn]: userId,
    stripe_subscription_id: subscription.id,
    status,
    current_period_start: subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : null,
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
  };
  if (meta.plan_slug) payload.plan_slug = meta.plan_slug;
  if (status === "canceled") {
    payload.canceled_at = subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : new Date().toISOString();
  }

  const { data: existing } = await supabase
    .from(table)
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (existing?.id) {
    await supabase.from(table).update(payload).eq("id", existing.id);
  } else {
    // Upsert on the owner column so a pre-existing onboarding row is updated
    // in place (requires migration 025's unique owner index).
    await supabase.from(table).upsert(payload, { onConflict: idColumn });
  }

  // Plan changes drive the verified (blue) badge — recompute it immediately.
  if (role === "creator") {
    try {
      const { refreshCreatorBadges } = await import("@/lib/badges");
      await refreshCreatorBadges(userId);
    } catch {
      /* badge refresh is best-effort; the daily cron reconciles drift */
    }
  }
}

/** Find a conversion by its Stripe payment intent id. */
async function findConversionByPaymentIntent(
  supabase: SupabaseClient,
  paymentIntentId: string,
): Promise<{ id: string; order_amount: number; hold_expires_at: string | null; tracking_link_id: string | null } | null> {
  const { data } = await supabase
    .from("conversions")
    .select("id, order_amount, hold_expires_at, tracking_link_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .single();
  return (
    (data as { id: string; order_amount: number; hold_expires_at: string | null; tracking_link_id: string | null } | null) ??
    null
  );
}

/**
 * Plan-based hold days for a conversion's creator (v3: Free 7d, Pro 5d,
 * Premium 3d). Falls back to the 7-day default when the link/creator or
 * subscription row can't be resolved.
 */
async function holdDaysForConversionCreator(
  supabase: SupabaseClient,
  conversion: { tracking_link_id: string | null },
): Promise<number> {
  if (!conversion.tracking_link_id) return ESCROW_HOLD_DAYS;
  const { data: link } = await supabase
    .from("tracking_links")
    .select("creator_id")
    .eq("id", conversion.tracking_link_id)
    .single();
  if (!link?.creator_id) return ESCROW_HOLD_DAYS;
  const { data: sub } = await supabase
    .from("creator_subscriptions")
    .select("plan_slug")
    .eq("creator_id", link.creator_id)
    .eq("status", "active")
    .maybeSingle();
  return escrowHoldDaysForPlan(sub?.plan_slug as string | null | undefined);
}

/** Find a conversion by its Stripe transfer id. */
async function findConversionByTransfer(
  supabase: SupabaseClient,
  transferId: string,
): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from("conversions")
    .select("id")
    .eq("stripe_transfer_id", transferId)
    .single();
  return (data as { id: string } | null) ?? null;
}

/**
 * The full Stripe webhook event handler. Kept separate from the route so it can
 * be invoked directly (tests / scripts) and so the route stays a thin,
 * idempotency-focused wrapper.
 */
export async function handleStripeEvent(
  event: Stripe.Event,
  supabase: SupabaseClient,
): Promise<void> {
  // transfer.paid / transfer.failed are valid Stripe events but are absent from
  // the pinned SDK version's Event type union, so widen it here.
  switch (event.type as Stripe.Event["type"] | "transfer.paid" | "transfer.failed") {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      const ready = account.charges_enabled === true && account.details_submitted === true;

      // v2 accounts have no metadata, so fall back to the stored account id.
      let userId = account.metadata?.user_id;
      let table: "creator_profiles" | "business_profiles" | null = account.metadata?.user_id ? "creator_profiles" : null;

      if (!userId) {
        const { data: creator } = await supabase
          .from("creator_profiles")
          .select("user_id")
          .eq("stripe_account_id", account.id)
          .single();
        if (creator?.user_id) {
          userId = creator.user_id;
          table = "creator_profiles";
        } else {
          const { data: business } = await supabase
            .from("business_profiles")
            .select("user_id")
            .eq("stripe_account_id", account.id)
            .single();
          if (business?.user_id) {
            userId = business.user_id;
            table = "business_profiles";
          }
        }
      }

      if (userId) {
        // If metadata gave us the user id but not which table, detect by id.
        if (!table) {
          const { data: business } = await supabase
            .from("business_profiles")
            .select("user_id")
            .eq("user_id", userId)
            .single();
          table = business?.user_id ? "business_profiles" : "creator_profiles";
        }
        await supabase.from(table).update({
          stripe_account_id: account.id,
          stripe_connect_ready: ready,
        }).eq("user_id", userId);
      }
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const role = session.metadata?.role;

      // Setup mode: store the billing customer id on the profile.
      if (session.mode === "setup" && userId && session.customer) {
        const table = role === "business" ? "business_profiles" : "creator_profiles";
        await supabase.from(table).update({ stripe_customer_id: session.customer }).eq("user_id", userId);
        break;
      }

      // Subscription mode: fetch the subscription and sync it.
      if (session.mode === "subscription" && typeof session.subscription === "string") {
        const stripe = getStripeClient();
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await syncSubscription(subscription, supabase);
        break;
      }

      // One-time payment: credit the business balance for top-ups.
      if (session.mode === "payment" && session.metadata?.kind === "topup" && userId) {
        const amountCents = session.amount_total ?? 0;
        if (amountCents > 0) {
          await creditBalance(
            supabase,
            userId,
            amountCents,
            "topup",
            "Stripe balance top-up",
            session.id,
          );
        }
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object as Stripe.Subscription, supabase);
      break;
    }

    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      if (!customerId) break;
      const status = event.type === "invoice.payment_succeeded" ? "active" : "past_due";
      const { data: business } = await supabase
        .from("business_profiles").select("user_id").eq("stripe_customer_id", customerId).single();
      if (business?.user_id) {
        await supabase.from("business_subscriptions").update({ status }).eq("business_id", business.user_id);
      } else {
        const { data: creator } = await supabase
          .from("creator_profiles").select("user_id").eq("stripe_customer_id", customerId).single();
        if (creator?.user_id) {
          await supabase.from("creator_subscriptions").update({ status }).eq("creator_id", creator.user_id);
        }
      }
      break;
    }

    // A 3DS-queued charge completed: restart the plan-based hold and clear the
    // retry (no-op for the normal immediate-success path, where the hold is
    // already set).
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const conversion = await findConversionByPaymentIntent(supabase, pi.id);
      if (conversion && !conversion.hold_expires_at) {
        const holdDays = await holdDaysForConversionCreator(supabase, conversion);
        await supabase
          .from("conversions")
          .update({
            status: "pending_hold",
            hold_expires_at: escrowHoldExpiresAt(Date.now(), holdDays),
          })
          .eq("id", conversion.id);
        await supabase
          .from("charge_retries")
          .update({ status: "completed" })
          .eq("conversion_id", conversion.id);
      }
      break;
    }

    // A payment that failed must release the held funds. Reuse the same
    // idempotent neutralization as the synchronous charge helper — a decline
    // can surface both there and here, and only one should write the reversal.
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const conversion = await findConversionByPaymentIntent(supabase, pi.id);
      if (conversion) {
        await markChargeFailed(
          conversion.id,
          `Stripe reported the payment failed${pi.last_payment_error?.message ? `: ${pi.last_payment_error.message}` : ""}.`,
        );
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
      if (piId) {
        const conversion = await findConversionByPaymentIntent(supabase, piId);
        if (conversion) {
          await applyRefund(conversion.id, (charge.amount_refunded ?? 0) / 100);
        }
      }
      break;
    }

    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      if (dispute.status !== "lost") break;
      const piId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : null;
      if (piId) {
        const conversion = await findConversionByPaymentIntent(supabase, piId);
        if (conversion) {
          await applyChargeback(conversion.id, dispute.amount / 100);
        }
      }
      break;
    }

    // A failed transfer puts the money back: re-hold the conversion and notify.
    case "transfer.failed": {
      const transfer = event.data.object as Stripe.Transfer;
      const conversion = await findConversionByTransfer(supabase, transfer.id);
      if (conversion) {
        await supabase.from("conversions").update({ status: "pending_hold" }).eq("id", conversion.id);
      }
      break;
    }

    // transfer.paid is a confirmation only — nothing to mutate.
    case "transfer.paid":
    default:
      break;
  }
}
