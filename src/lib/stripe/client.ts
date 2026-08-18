import Stripe from "stripe";

/**
 * Active Stripe currency for charges/transfers. Defaults to USD; set
 * STRIPE_CURRENCY (e.g. gbp) to match the platform account's settlement
 * currency and avoid cross-currency conversion fees on live charges.
 */
export function getStripeCurrency(): string {
  return (process.env.STRIPE_CURRENCY ?? "usd").toLowerCase();
}

export function getStripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
  });
}

export function verifyStripeWebhookSignature(
  body: string | Buffer,
  signature: string,
): Stripe.Event {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
}

export const STRIPE_CONNECT_V2_VERSION = "2026-07-29.preview";

/**
 * Create a connected account via the Accounts v2 API (POST /v2/core/accounts).
 * Creators are `merchant` (accept indirect-charge payments) + `recipient`
 * (receive transfers), which is the v2 equivalent of an Express account.
 *
 * Verified live: the resulting `acct_` id is accepted by the v1
 * `account_links` and `transfers` endpoints, so onboarding + payouts keep
 * using the typed SDK — only account creation goes through v2 here.
 */
export async function createConnectedAccountV2(opts: {
  email: string;
  name?: string;
  country?: string;
}): Promise<string> {
  const res = await fetch("https://api.stripe.com/v2/core/accounts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/json",
      "Stripe-Version": STRIPE_CONNECT_V2_VERSION,
    },
    body: JSON.stringify({
      contact_email: opts.email,
      display_name: opts.name ?? "",
      dashboard: "express",
      identity: {
        country: (opts.country ?? "us").toLowerCase(),
        entity_type: "individual",
      },
      configuration: {
        merchant: {
          capabilities: { card_payments: { requested: true } },
        },
        recipient: {
          capabilities: {
            stripe_balance: { stripe_transfers: { requested: true } },
          },
        },
      },
      defaults: {
        currency: getStripeCurrency(),
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
        },
        locales: ["en-US"],
      },
      include: ["configuration.recipient", "identity", "requirements"],
    }),
  });
  if (!res.ok) {
    throw new Error(`Stripe Accounts v2 create failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Create (or reuse) a creator's Connect account. Tries the v1 Express path
 * first — which still works for platforms Stripe hasn't migrated — and falls
 * back to the Accounts v2 API when v1 account creation is blocked.
 */
export async function createCreatorConnectAccount(opts: {
  userId: string;
  email: string;
  name?: string;
}): Promise<string> {
  const stripe = getStripeClient();

  // Reuse an existing account tagged with this user (covers accounts created
  // before the v2 switchover).
  try {
    const accounts = await stripe.accounts.list({ limit: 100 });
    const existing = accounts.data.find((a) => a.metadata?.user_id === opts.userId);
    if (existing) return existing.id;
  } catch {
    // listing may fail on v2-only accounts — fall through to creation
  }

  try {
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { user_id: opts.userId, email: opts.email },
    });
    return account.id;
  } catch {
    // v1 creation blocked → Accounts v2.
    return await createConnectedAccountV2({ email: opts.email, name: opts.name });
  }
}

export function calculateCreatorCut(totalAmount: number): number {
  const rawCut = totalAmount * 0.9;
  // Round to cents (2 decimals) — money must never lose cent precision.
  return Math.round(rawCut * 100) / 100;
}

export function calculatePlatformFee(totalAmount: number): number {
  return totalAmount - calculateCreatorCut(totalAmount);
}
