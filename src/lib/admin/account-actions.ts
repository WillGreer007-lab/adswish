import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripeClient } from "@/lib/stripe/client";

export type AccountRole = "creator" | "business";

const SUBSCRIPTION_TABLES = {
  creator: { table: "creator_subscriptions", key: "creator_id" },
  business: { table: "business_subscriptions", key: "business_id" },
} as const;

/**
 * Cancel the underlying Stripe subscription so the customer is not billed
 * again. Best-effort: a failure never blocks the local DB change.
 */
export async function cancelStripeSubscription(subscriptionId: string | null): Promise<boolean> {
  if (!subscriptionId) return false;
  try {
    const stripe = getStripeClient();
    await stripe.subscriptions.cancel(subscriptionId);
    return true;
  } catch (err) {
    console.error("Failed to cancel Stripe subscription:", subscriptionId, String(err));
    return false;
  }
}

/**
 * Reactivate a Stripe subscription that was canceled at period end. Fully
 * canceled/deleted subscriptions can't be revived this way — the caller
 * reports `stripe_resumed: false` and the user must re-subscribe via checkout.
 */
export async function resumeStripeSubscription(subscriptionId: string | null): Promise<boolean> {
  if (!subscriptionId) return false;
  try {
    const stripe = getStripeClient();
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
    return true;
  } catch (err) {
    console.error("Failed to resume Stripe subscription:", subscriptionId, String(err));
    return false;
  }
}

interface SubscriptionRow {
  plan_slug: string | null;
  status: string | null;
  stripe_subscription_id: string | null;
}

/**
 * Flip the account's subscription to canceled and (optionally) cancel the
 * Stripe subscription. Returns the previous state + whether Stripe was reached.
 */
export async function cancelPlanForAccount(
  service: SupabaseClient,
  role: AccountRole,
  userId: string,
  cancelStripe: boolean,
): Promise<{
  stripeCanceled: boolean;
  previousPlan: string | null;
  previousStatus: string | null;
}> {
  const { table, key } = SUBSCRIPTION_TABLES[role];
  const { data: sub } = await service
    .from(table)
    .select("plan_slug, status, stripe_subscription_id")
    .eq(key, userId)
    .maybeSingle();
  const row = (sub ?? null) as SubscriptionRow | null;

  await service
    .from(table)
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq(key, userId);

  const stripeCanceled = cancelStripe
    ? await cancelStripeSubscription(row?.stripe_subscription_id ?? null)
    : false;

  return {
    stripeCanceled,
    previousPlan: row?.plan_slug ?? null,
    previousStatus: row?.status ?? null,
  };
}

/**
 * Restore a canceled subscription to active and (optionally) reactivate the
 * Stripe subscription if it was only canceled at period end.
 */
export async function resumePlanForAccount(
  service: SupabaseClient,
  role: AccountRole,
  userId: string,
  resumeStripe: boolean,
): Promise<{
  stripeResumed: boolean;
  planSlug: string | null;
}> {
  const { table, key } = SUBSCRIPTION_TABLES[role];
  const { data: sub } = await service
    .from(table)
    .select("plan_slug, stripe_subscription_id")
    .eq(key, userId)
    .maybeSingle();
  const row = (sub ?? null) as { plan_slug: string | null; stripe_subscription_id: string | null } | null;

  await service
    .from(table)
    .update({ status: "active", canceled_at: null })
    .eq(key, userId);

  const stripeResumed = resumeStripe
    ? await resumeStripeSubscription(row?.stripe_subscription_id ?? null)
    : false;

  return { stripeResumed, planSlug: row?.plan_slug ?? null };
}
