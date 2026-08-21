-- 049: Add 'resume_plan' to the admin audit-log action types (admins can
-- restore a canceled subscription from the user directory).

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
    'resume_plan',
    'terminate_account',
    'pause_payments',
    'resume_payments'
  ));
