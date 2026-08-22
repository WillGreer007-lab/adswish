export type UserRole = "creator" | "business" | "admin";

export type AccountStatus = "active" | "suspended" | "banned" | "pending";

export type CampaignType = "fixed" | "affiliate" | "hybrid";

export type CampaignStatus =
  | "draft"
  | "active"
  | "paused"
  | "paused_budget"
  | "completed"
  | "cancelled";

export type Visibility = "public" | "invite" | "unlisted";

export type ApplicationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type DeliverableStatus =
  | "pending"
  | "grace_period"
  | "pending_business_review"
  | "completed"
  | "kicked"
  | "dropped_by_business"
  | "auto_dropped_sla";

export type ConversionStatus =
  | "pending_hold"
  | "released"
  | "disputed"
  | "refunded"
  | "chargeback";

export type CreatorTier = "micro" | "mid" | "macro";

export type PaymentBadgeColor = "amber" | "blue" | "violet";

export type SubscriptionPlanSlug =
  | "creator_free"
  | "creator_pro"
  | "creator_premium"
  | "business_free"
  | "business_growth"
  | "business_enterprise";

export type SLADisputeStatus =
  | "open"
  | "in_review"
  | "resolved"
  | "dismissed";

export type SLADisputeResolution =
  | "force_release"
  | "refund_business"
  | "split"
  | "dismissed";

export type LedgerEntryType =
  | "hold"
  | "release"
  | "refund"
  | "chargeback_clawback"
  | "platform_fee"
  | "stripe_fee"
  | "subscription_revenue";

export type NotificationType =
  | "payment"
  | "application"
  | "sla"
  | "pixel_offline"
  | "review"
  | "message"
  | "system"
  | "uptime_outage";

export type AttributionMethod = "cookie" | "s2s" | "utm_fallback" | "manual";

export interface Campaign {
  id: string;
  business_id: string;
  title: string;
  description: string;
  type: CampaignType;
  commission_pct: number | null;
  fixed_amount: number | null;
  attribution_days: number | null;
  pixel_status: "unverified" | "active" | "offline";
  last_pixel_ping_at: string | null;
  offline_warning_sent_at: string | null;
  status: CampaignStatus;
  budget_cap: number | null;
  total_spent: number;
  visibility: Visibility;
  niche: string[];
  currency: string;
  end_date: string | null;
  pause_reason: string | null;
  paused_at: string | null;
  paused_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorProfile {
  user_id: string;
  display_name: string;
  profile_picture_url: string | null;
  bio: string;
  account_status: AccountStatus;
  strikes: number;
  average_rating: number;
  tier: CreatorTier;
  previous_tier: CreatorTier | null;
  tier_changed_at: string | null;
  onboarding_step: string;
  phone_number: string | null;
  deleted_at: string | null;
  stripe_connect_ready: boolean;
}

export interface BusinessProfile {
  user_id: string;
  company_name: string;
  logo_url: string | null;
  bio: string;
  account_status: AccountStatus;
  strikes: number;
  average_rating: number;
  verified_domain: string | null;
  kyb_status: "pending" | "verified" | "rejected" | "not_required";
  tax_jurisdiction: string | null;
  tax_id: string | null;
  paused_at: string | null;
  paused_by: string | null;
  deleted_at: string | null;
  campaigns_created_this_month: number;
  campaigns_created_month: string;
}

export interface Application {
  id: string;
  campaign_id: string;
  creator_id: string;
  status: ApplicationStatus;
  applied_at: string;
  decided_at: string | null;
  cover_note: string | null;
  tier_at_application: CreatorTier;
  withdrawn_at: string | null;
  withdrawn_reason: string | null;
}

export interface Deliverable {
  id: string;
  campaign_id: string;
  creator_id: string;
  slot_number: number;
  required_hashtag: string;
  deadline_date: string;
  warning_sent_at: string | null;
  submitted_url: string | null;
  hashtag_verified: boolean;
  business_approved: boolean;
  approved_at: string | null;
  tracking_link_id: string | null;
  status: DeliverableStatus;
  extended_deadline_at: string | null;
  grace_period_task_id: string | null;
  deleted_at: string | null;
}

export interface Conversion {
  id: string;
  tracking_link_id: string;
  order_id: string;
  order_amount: number;
  currency: string;
  creator_cut: number;
  platform_cut: number;
  status: ConversionStatus;
  hold_expires_at: string | null;
  disputed_at: string | null;
  attribution_method: AttributionMethod;
  created_at: string;
}
