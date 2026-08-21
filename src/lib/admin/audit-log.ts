import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function logAdminAction(params: {
  adminId: string;
  actionType:
    | "force_release"
    | "refund"
    | "ban_user"
    | "unban_user"
    | "suspend_user"
    | "unsuspend_user"
    | "approve_follower_verification"
    | "reject_follower_verification"
    | "resolve_dispute"
    | "manual_strike"
    | "override_rating"
    | "toggle_oauth_provider"
    | "cancel_plan"
    | "resume_plan"
    | "terminate_account"
    | "pause_payments"
    | "resume_payments";
  targetEntityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createSupabaseServiceRoleClient();

  const { error } = await supabase.from("admin_audit_logs").insert({
    admin_id: params.adminId,
    action_type: params.actionType,
    target_entity_id: params.targetEntityId || null,
    metadata: params.metadata || {},
  });

  if (error) {
    console.error("Failed to write admin audit log:", error.message);
  }
}
