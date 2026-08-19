/**
 * Payout math shared by conversion recording and Stripe webhooks.
 *
 * The 90/10 split is the money the platform actually moves, so it lives here
 * as a single tested source of truth instead of being re-derived inline in
 * multiple files. Rounding always happens to cents and the platform fee is the
 * remainder, so creator_cut + platform_cut always equals the order amount.
 */

export const PLATFORM_COMMISSION_RATE = 0.1;
export const ESCROW_HOLD_DAYS = 7;

/** 90% of the order amount, rounded to cents (2 decimals). */
export function calculateCreatorCut(totalAmount: number): number {
  const rawCut = totalAmount * (1 - PLATFORM_COMMISSION_RATE);
  return Math.round(rawCut * 100) / 100;
}

/**
 * The remainder, rounded to cents — always makes
 * creator_cut + platform_cut === totalAmount (cent-exact).
 */
export function calculatePlatformFee(totalAmount: number): number {
  const creatorCut = calculateCreatorCut(totalAmount);
  return Math.round((totalAmount - creatorCut) * 100) / 100;
}

/** When the escrow hold on a conversion expires (UTC ISO string). */
export function escrowHoldExpiresAt(fromMs: number = Date.now()): string {
  return new Date(fromMs + ESCROW_HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
