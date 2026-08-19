import type { SupabaseClient } from "@supabase/supabase-js";

export const MIN_CASHOUT_CENTS = 1000; // £10 minimum
export const CASHOUT_FEE_BPS = 1000; // 10% platform fee → business keeps 90%

export type BalanceTransactionType =
  | "topup"
  | "campaign_spend"
  | "refund"
  | "cashout"
  | "adjustment";

/**
 * Credit a business balance and append a ledger row. Positive amount.
 * Returns the new balance in cents.
 */
export async function creditBalance(
  supabase: SupabaseClient,
  businessId: string,
  amountCents: number,
  type: BalanceTransactionType,
  description: string,
  referenceId?: string,
): Promise<number> {
  const { data: profile } = await supabase
    .from("business_profiles")
    .select("balance_cents")
    .eq("user_id", businessId)
    .single();

  const before = Number(profile?.balance_cents ?? 0);
  const after = before + amountCents;

  await supabase
    .from("business_profiles")
    .update({ balance_cents: after })
    .eq("user_id", businessId);

  await supabase.from("balance_transactions").insert({
    business_id: businessId,
    type,
    amount_cents: amountCents,
    balance_after_cents: after,
    description,
    reference_id: referenceId ?? null,
  });

  return after;
}

export type DebitResult =
  | { ok: true; balanceAfter: number }
  | { ok: false; reason: "insufficient" | "not_found"; balance: number };

/**
 * Debit a business balance and append a ledger row (negative amount).
 * Fails cleanly when the balance is too low.
 */
export async function debitBalance(
  supabase: SupabaseClient,
  businessId: string,
  amountCents: number,
  type: BalanceTransactionType,
  description: string,
  referenceId?: string,
): Promise<DebitResult> {
  const { data: profile } = await supabase
    .from("business_profiles")
    .select("balance_cents")
    .eq("user_id", businessId)
    .single();

  if (!profile) return { ok: false, reason: "not_found", balance: 0 };

  const before = Number(profile.balance_cents ?? 0);
  if (before < amountCents) {
    return { ok: false, reason: "insufficient", balance: before };
  }

  const after = before - amountCents;
  await supabase
    .from("business_profiles")
    .update({ balance_cents: after })
    .eq("user_id", businessId);

  await supabase.from("balance_transactions").insert({
    business_id: businessId,
    type,
    amount_cents: -amountCents,
    balance_after_cents: after,
    description,
    reference_id: referenceId ?? null,
  });

  return { ok: true, balanceAfter: after };
}

export function cashoutSplit(amountCents: number): {
  feeCents: number;
  netCents: number;
} {
  const feeCents = Math.round((amountCents * CASHOUT_FEE_BPS) / 10000);
  return { feeCents, netCents: amountCents - feeCents };
}
