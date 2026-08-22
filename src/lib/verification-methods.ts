/**
 * Verification methods + status computation.
 *
 * A creator verifies their social reach one of two ways (shown as two boxes in
 * onboarding Step 2 and in the dashboard Settings "Connected accounts" panel):
 *
 *   1. AUTOMATION SETUP  — connect via OAuth / API key. The follower count is
 *      pulled live from the platform and verified instantly, with no admin
 *      review. (Instagram + TikTok OAuth, YouTube self-serve API key.)
 *
 *   2. MANUAL SIGN UP    — post a per-account code into your bio, upload a
 *      screenshot, and an admin reviews it. Follower count stays "claimed"
 *      until approval.
 *
 * Each box carries a status badge so the creator can see where they stand.
 */

export type VerificationMethod = "automation" | "manual";

export type MethodStatus = "not_started" | "requires_review" | "completed" | "failed";

export interface ConnectedSocialAccount {
  platform: string;
  verified_at: string | null;
  disconnected_at?: string | null;
}

export interface ManualVerificationLike {
  status: "pending" | "approved" | "rejected";
}

/**
 * Automation status: "completed" once any OAuth/self-serve account is verified,
 * "failed" when the last connect errored (the OAuth callback bounced back with
 * ?error=...), otherwise "not_started".
 */
export function automationStatus(
  accounts: ConnectedSocialAccount[],
  oauthError: boolean = false,
): MethodStatus {
  const active = (accounts ?? []).filter((a) => !a.disconnected_at);
  if (active.some((a) => a.verified_at)) return "completed";
  if (oauthError) return "failed";
  return "not_started";
}

/**
 * Manual status from the creator's manual screenshot submissions:
 * approved → completed, pending → requires_review, rejected → failed,
 * none → not_started.
 */
export function manualStatus(verifications: ManualVerificationLike[]): MethodStatus {
  if ((verifications ?? []).some((v) => v.status === "approved")) return "completed";
  if ((verifications ?? []).some((v) => v.status === "pending")) return "requires_review";
  if ((verifications ?? []).some((v) => v.status === "rejected")) return "failed";
  return "not_started";
}
