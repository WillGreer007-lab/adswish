-- 048: Admin account management (cancel plan, terminate, pause payments) +
-- new audit-log action types.
--
-- Pause/resume payments is a per-account flag that stops money movement:
--   * creators: processWeeklyPayouts / releaseConversion skip the Stripe transfer
--   * businesses: createDestinationChargeForConversion skips charging their card
-- The flag is set by the admin user-management route and audit logged.

-- 1. Expand the admin audit-log action types.
ALTER TABLE public.admin_audit_logs
  DROP CONSTRAINT IF EXISTS admin_audit_logs_action_type_check;

ALTER TABLE public.admin_audit_logs
  ADD CONSTRAINT admin_audit_logs_action_type_check
  CHECK (action_type IN (
    'force_release',
    'refund',
    'ban_user',
    'unban_user',
    'suspend_user',
    'unsuspend_user',
    'resolve_dispute',
    'manual_strike',
    'override_rating',
    'approve_follower_verification',
    'reject_follower_verification',
    'toggle_oauth_provider',
    'cancel_plan',
    'terminate_account',
    'pause_payments',
    'resume_payments'
  ));

-- 2. Payout pause flags on both profile types.
ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS payouts_paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS payouts_paused_by uuid;

ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS payouts_paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS payouts_paused_by uuid;
