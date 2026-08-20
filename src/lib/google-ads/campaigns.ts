import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { GoogleAdsNotConfiguredError, developerToken } from "@/lib/google-ads/client";

export { GoogleAdsNotConfiguredError };

export type GoogleAdsCampaignInput = {
  goal: "search" | "social" | "pmax";
  targetLocation?: string;
  dailyBudgetCents?: number;
  adswishCampaignId?: string | null;
  googleCampaignName?: string;
};

export type KillSwitchSettings = {
  maxDaily?: number;
  maxTotal?: number;
  minConversions?: number;
  minRoas?: number;
};

/** Guard the live Ads API paths — the token is only needed at runtime. */
export function requireDeveloperToken(): void {
  if (!developerToken()) throw new GoogleAdsNotConfiguredError();
}

export async function createCampaignRecord(
  userId: string,
  input: GoogleAdsCampaignInput,
): Promise<{ id: string; status: string } | null> {
  const sb = createSupabaseServiceRoleClient();
  const { data, error } = await sb
    .from("google_ads_campaigns")
    .insert({
      user_id: userId,
      adswish_campaign_id: input.adswishCampaignId ?? null,
      goal: input.goal,
      target_location: input.targetLocation ?? null,
      daily_budget_cents: input.dailyBudgetCents ?? null,
      google_campaign_name: input.googleCampaignName ?? null,
      status: "draft",
    })
    .select("id, status")
    .single();
  if (error || !data) return null;
  return data as { id: string; status: string };
}

export async function listCampaignRecords(userId: string) {
  const sb = createSupabaseServiceRoleClient();
  const { data } = await sb
    .from("google_ads_campaigns")
    .select(
      "id, adswish_campaign_id, google_campaign_id, google_campaign_name, goal, target_location, daily_budget_cents, status, total_spend_cents, conversions, revenue_cents, last_synced_at, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getCampaignRecord(userId: string, campaignId: string) {
  const sb = createSupabaseServiceRoleClient();
  const { data } = await sb
    .from("google_ads_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("user_id", userId)
    .single();
  return (data as Record<string, unknown> | null) ?? null;
}

export async function setCampaignStatus(
  userId: string,
  campaignId: string,
  status: "draft" | "pending" | "active" | "paused" | "removed" | "tracking_injected",
): Promise<boolean> {
  const sb = createSupabaseServiceRoleClient();
  const { data, error } = await sb
    .from("google_ads_campaigns")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("user_id", userId)
    .select("id")
    .single();
  return Boolean(!error && data);
}

export async function stampGoogleCampaignId(
  userId: string,
  campaignId: string,
  googleCampaignId: string,
): Promise<void> {
  const sb = createSupabaseServiceRoleClient();
  await sb
    .from("google_ads_campaigns")
    .update({
      google_campaign_id: googleCampaignId,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("user_id", userId);
}

export async function addTrackingTemplate(
  userId: string,
  campaignId: string,
  templateUrl: string,
  finalUrlSuffix: string,
): Promise<boolean> {
  const sb = createSupabaseServiceRoleClient();
  const { error } = await sb.from("google_ads_tracking_templates").insert({
    campaign_id: campaignId,
    template_url: templateUrl,
    final_url_suffix: finalUrlSuffix,
    parallel_tracking_enabled: true,
  });
  if (error) return false;
  return setCampaignStatus(userId, campaignId, "tracking_injected");
}

export async function logActivity(
  userId: string,
  kind: "info" | "success" | "warning" | "error",
  message: string,
  campaignId?: string | null,
): Promise<void> {
  const sb = createSupabaseServiceRoleClient();
  await sb.from("google_ads_activity_log").insert({
    user_id: userId,
    campaign_id: campaignId ?? null,
    kind,
    message,
  });
}

export async function listActivity(userId: string, limit = 20) {
  const sb = createSupabaseServiceRoleClient();
  const { data } = await sb
    .from("google_ads_activity_log")
    .select("id, kind, message, campaign_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getKillSwitch(userId: string): Promise<KillSwitchSettings> {
  const sb = createSupabaseServiceRoleClient();
  const { data } = await sb
    .from("google_ads_connections")
    .select("kill_switch")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.kill_switch as KillSwitchSettings | null) ?? {};
}

export async function saveKillSwitch(
  userId: string,
  settings: KillSwitchSettings,
): Promise<void> {
  const sb = createSupabaseServiceRoleClient();
  await sb
    .from("google_ads_connections")
    .upsert(
      { user_id: userId, kill_switch: settings, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
}
