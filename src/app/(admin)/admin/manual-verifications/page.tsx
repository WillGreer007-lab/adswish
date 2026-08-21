import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { ManualVerificationReview, type ManualVerificationReviewRow } from "@/components/admin/manual-verification-review";

export const dynamic = "force-dynamic";

const BUCKET = "creator-verification";

export default async function AdminManualVerificationsPage() {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("manual_follower_verifications")
    .select("id, creator_id, platform, handle, claimed_follower_count, verification_token, screenshot_url, storage_path, status, review_notes, created_at, creator_profiles(display_name, profile_picture_url)")
    .order("created_at", { ascending: true });

  const rows = await Promise.all((data ?? []).map(async (row: any) => {
    let screenshotUrl = row.screenshot_url?.startsWith("http") ? row.screenshot_url : null;
    const path = row.storage_path || (!row.screenshot_url?.startsWith("http") ? row.screenshot_url : null);
    if (path) {
      const { data: signed } = await service.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
      screenshotUrl = signed?.signedUrl ?? screenshotUrl;
    }
    return {
      ...row,
      screenshot_url: screenshotUrl,
      creator_profiles: Array.isArray(row.creator_profiles) ? row.creator_profiles[0] ?? null : row.creator_profiles,
    } as ManualVerificationReviewRow;
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-background">Manual follower verification</h1>
        <p className="text-sm text-background/60">Review creator screenshots for TikTok, Instagram, and YouTube before their follower counts become verified.</p>
      </div>
      <ManualVerificationReview initial={rows} />
    </div>
  );
}
