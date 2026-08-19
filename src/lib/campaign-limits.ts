/**
 * Free-plan campaign creation limit.
 *
 * Free businesses may create up to FREE_PLAN_MONTHLY_LIMIT "active" campaigns
 * per calendar month. The counter lives on business_profiles as
 * campaigns_created_this_month + campaigns_created_month ("YYYY-MM").
 */

export const FREE_PLAN_MONTHLY_LIMIT = 3;

export type CampaignCounterState = {
  /** Month ("YYYY-MM") the counter currently belongs to, or null if never set. */
  campaigns_created_month: string | null;
  /** Number of active campaigns created so far in campaigns_created_month. */
  campaigns_created_this_month: number;
};

/** The persisted counter shape — `campaigns_created_month` is NOT NULL in the DB. */
export type CampaignCounterUpdate = Omit<CampaignCounterState, "campaigns_created_month"> & {
  campaigns_created_month: string;
};

export type CampaignLimitResult =
  | { allowed: true; used: number; remaining: number; next: CampaignCounterUpdate }
  | { allowed: false; used: number; remaining: 0 };

/**
 * Decide whether a free-plan business may create a new active campaign, and if
 * so, what the persisted counter should become.
 *
 * Counter semantics: if the stored month differs from `currentMonth`, the
 * counter is stale (a new month) and effectively resets to 0.
 */
export function evaluateFreePlanCampaignLimit(
  state: CampaignCounterState,
  currentMonth: string,
  limit: number = FREE_PLAN_MONTHLY_LIMIT,
): CampaignLimitResult {
  const used = state.campaigns_created_month === currentMonth ? state.campaigns_created_this_month : 0;

  if (used >= limit) {
    return { allowed: false, used, remaining: 0 };
  }

  const next: CampaignCounterUpdate = {
    campaigns_created_month: currentMonth,
    campaigns_created_this_month: used + 1,
  };
  return { allowed: true, used, remaining: limit - used - 1, next };
}
