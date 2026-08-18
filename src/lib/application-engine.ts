// Pure application state-machine logic extracted from the applications route so
// it can be exercised in integration tests without a live database. The route
// delegates to these functions, so the tests cover the real production logic.

export type Tier = "micro" | "mid" | "macro";
export type CampaignType = "fixed" | "affiliate" | "hybrid";
export type ApplicationStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export interface CreatorProfileInput {
  tier: Tier;
  account_status: string;
  strikes: number;
}

export interface CampaignInput {
  id: string;
  type: CampaignType;
  status: string;
  deliverable_count: number;
  deadline_days: number | null;
}

export interface ApplyDecision {
  ok: boolean;
  status?: number;
  error?: string;
  /** The per-24h application limit that applied (for messages/tests). */
  limit?: number;
}

export interface EvaluateApplyArgs {
  profile: CreatorProfileInput | null;
  campaign: CampaignInput | null;
  /** Tier's allowed campaign types (TIER_LIMITS[tier].campaignTypes). */
  allowedCampaignTypes: CampaignType[];
  maxActiveCampaigns: number;
  /** True when an application already exists for (campaign, creator). */
  existingApplication: boolean;
  activeApplicationCount: number;
  applicationsLast24h: number;
  applyLimit: number;
}

/**
 * The full guard chain for POST /api/internal/applications, in order. Returns
 * the first blocking decision, or `{ ok: true }` when the apply may proceed.
 */
export function evaluateApply(args: EvaluateApplyArgs): ApplyDecision {
  if (!args.profile) {
    return { ok: false, status: 404, error: "Creator profile not found" };
  }
  if (args.profile.account_status !== "active") {
    return { ok: false, status: 403, error: "Account is not active" };
  }
  if (args.profile.strikes >= 3) {
    return { ok: false, status: 403, error: "Account banned due to 3 strikes" };
  }
  if (!args.campaign) {
    return { ok: false, status: 404, error: "Campaign not found" };
  }
  if (args.campaign.status !== "active") {
    return { ok: false, status: 422, error: "Campaign is not active" };
  }
  if (!args.allowedCampaignTypes.includes(args.campaign.type)) {
    return {
      ok: false,
      status: 422,
      error: `Your tier cannot apply to ${args.campaign.type} campaigns`,
    };
  }
  if (args.applicationsLast24h >= args.applyLimit) {
    return {
      ok: false,
      status: 429,
      error: `Application rate limit reached (${args.applyLimit}/24h). Try again later.`,
      limit: args.applyLimit,
    };
  }
  if (args.existingApplication) {
    return { ok: false, status: 409, error: "Already applied to this campaign" };
  }
  if (args.activeApplicationCount >= args.maxActiveCampaigns) {
    return {
      ok: false,
      status: 422,
      error: `Maximum active campaigns reached (${args.maxActiveCampaigns})`,
    };
  }
  return { ok: true };
}

/**
 * The legal status transitions for an application. A null result means the
 * action is not permitted from the current state.
 */
export function nextApplicationStatus(
  current: ApplicationStatus,
  action: "accept" | "reject" | "withdraw",
): ApplicationStatus | null {
  switch (action) {
    case "accept":
      return current === "pending" ? "accepted" : null;
    case "reject":
      return current === "pending" ? "rejected" : null;
    case "withdraw":
      return current === "pending" ? "withdrawn" : null;
  }
}

/**
 * Maps a Postgres insert error code from the applications insert to a
 * response. The UNIQUE(campaign_id, creator_id) constraint is what breaks the
 * concurrent-apply race: two creators (or a duplicate click) both pass the
 * guards, but only the first INSERT wins and the second gets 23505.
 */
export function mapApplicationInsertError(
  code: string | null,
): { status: number; error: string } {
  if (code === "23505") {
    return { status: 409, error: "Already applied to this campaign" };
  }
  return { status: 500, error: "Failed to create application" };
}

export interface DeliverableSlot {
  campaign_id: string;
  creator_id: string;
  slot_number: number;
  required_hashtag: string;
  deadline_date: string;
  status: "pending";
}

/**
 * Build the lock-and-key deliverable slots stamped on acceptance. Each slot's
 * hashtag is deterministic per (campaign, creator, slot), so two creators on
 * the same campaign get independent tracks.
 *
 * §8/§12 "deadline per deliverable": when the business stored per-slot
 * deadlines at creation, each slot gets its own; otherwise every slot falls
 * back to the campaign's uniform `deadline_days` from acceptance time.
 */
export function buildDeliverableSlots(
  campaign: {
    id: string;
    deliverable_count: number;
    deadline_days: number | null;
    deliverable_deadlines?: (string | null)[];
  },
  creatorId: string,
  now: Date = new Date(),
): DeliverableSlot[] {
  const deadlineDays = campaign.deadline_days || 14;
  const slots: DeliverableSlot[] = [];
  for (let i = 0; i < campaign.deliverable_count; i++) {
    const perSlot = campaign.deliverable_deadlines?.[i];
    const perSlotDate = perSlot ? new Date(perSlot) : null;
    const usePerSlot = perSlotDate && !Number.isNaN(perSlotDate.getTime()) && perSlotDate > now;

    slots.push({
      campaign_id: campaign.id,
      creator_id: creatorId,
      slot_number: i + 1,
      required_hashtag: `#Adswish${campaign.id.slice(0, 8)}${creatorId.slice(0, 4)}${i + 1}`,
      deadline_date: usePerSlot
        ? perSlotDate!.toISOString()
        : new Date(now.getTime() + deadlineDays * 24 * 60 * 60 * 1000).toISOString(),
      status: "pending",
    });
  }
  return slots;
}
