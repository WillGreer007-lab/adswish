import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GDPR Article 20 export. The response intentionally selects only user-facing
 * records and never includes OAuth access/refresh tokens, password material, or
 * service-role data.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: creator }, { data: business }] = await Promise.all([
    supabase
      .from("creator_profiles")
      .select("user_id, display_name, profile_picture_url, bio, account_status, strikes, average_rating, tier, niches, onboarding_step, created_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("business_profiles")
      .select("user_id, company_name, logo_url, bio, account_status, strikes, average_rating, verified_domain, kyb_status, onboarding_step, created_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const role = creator ? "creator" : business ? "business" : "unknown";
  let campaigns: unknown[] = [];
  let applications: unknown[] = [];
  let deliverables: unknown[] = [];
  let socialAccounts: unknown[] = [];
  let manualVerifications: unknown[] = [];
  let subscriptions: unknown[] = [];
  let teamMembers: unknown[] = [];

  if (role === "business") {
    const { data: ownCampaigns } = await supabase
      .from("campaigns")
      .select("*")
      .eq("business_id", user.id)
      .order("created_at", { ascending: true });
    campaigns = ownCampaigns ?? [];
    const campaignIds = (ownCampaigns ?? []).map((campaign) => campaign.id);

    const [{ data: ownApplications }, { data: ownDeliverables }, { data: ownSubscription }, { data: ownTeam }] = await Promise.all([
      campaignIds.length
        ? supabase.from("applications").select("*").in("campaign_id", campaignIds)
        : Promise.resolve({ data: [] }),
      campaignIds.length
        ? supabase.from("deliverables").select("*").in("campaign_id", campaignIds)
        : Promise.resolve({ data: [] }),
      supabase.from("business_subscriptions").select("plan_slug, stripe_subscription_id, status, current_period_start, current_period_end, canceled_at, team_seats_used, created_at").eq("business_id", user.id),
      supabase.from("business_team_members").select("business_id, user_id, role, invited_at, joined_at").eq("business_id", user.id),
    ]);
    applications = ownApplications ?? [];
    deliverables = ownDeliverables ?? [];
    subscriptions = ownSubscription ? [ownSubscription] : [];
    teamMembers = ownTeam ?? [];
  } else if (role === "creator") {
    const [{ data: ownApplications }, { data: ownSocial }, { data: ownManual }, { data: ownSubscription }, { data: ownDeliverables }] = await Promise.all([
      supabase.from("applications").select("*").eq("creator_id", user.id).order("created_at", { ascending: true }),
      supabase.from("creator_social_accounts").select("id, creator_id, platform, handle, follower_count, verified_at, disconnected_at, created_at, updated_at").eq("creator_id", user.id),
      supabase.from("manual_follower_verifications").select("id, creator_id, platform, handle, claimed_follower_count, status, review_notes, reviewed_at, created_at, updated_at").eq("creator_id", user.id),
      supabase.from("creator_subscriptions").select("plan_slug, stripe_subscription_id, status, current_period_start, current_period_end, canceled_at, created_at").eq("creator_id", user.id),
      supabase.from("deliverables").select("*").eq("creator_id", user.id),
    ]);
    applications = ownApplications ?? [];
    socialAccounts = ownSocial ?? [];
    manualVerifications = ownManual ?? [];
    subscriptions = ownSubscription ? [ownSubscription] : [];
    deliverables = ownDeliverables ?? [];

    const campaignIds = [...new Set((ownApplications ?? []).map((application) => application.campaign_id))];
    if (campaignIds.length) {
      const { data: appliedCampaigns } = await supabase.from("campaigns").select("*").in("id", campaignIds);
      campaigns = appliedCampaigns ?? [];
    }
  }

  const [messagesRes, reviewsRes, ledgerRes, invoicesRes, connectionsRes, preferencesRes] = await Promise.all([
    supabase.from("messages").select("id, campaign_id, sender_id, body, created_at").order("created_at", { ascending: true }).limit(5000),
    supabase.from("reviews").select("id, reviewer_id, reviewee_id, campaign_id, rating_out_of_5, written_feedback, creator_response, reported_by, created_at, updated_at").or(`reviewer_id.eq.${user.id},reviewee_id.eq.${user.id}`).order("created_at", { ascending: true }),
    supabase.from("ledger_entries").select("id, related_conversion_id, related_deliverable_id, type, amount, stripe_transfer_id, currency, created_at").order("created_at", { ascending: true }).limit(5000),
    role === "creator"
      ? supabase.from("payout_invoices").select("id, month_start, month_end, total_released, pdf_url, sent_at, created_at").eq("creator_id", user.id).order("month_start", { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase.from("connections").select("id, requester_id, addressee_id, status, created_at, updated_at").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).order("created_at", { ascending: true }),
    supabase.from("notification_preferences").select("muted_types, email_enabled, push_enabled, updated_at").eq("user_id", user.id).maybeSingle(),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email ?? null,
      role,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
    },
    profile: creator ?? business ?? null,
    campaigns,
    applications,
    deliverables,
    social_accounts: socialAccounts,
    manual_follower_verifications: manualVerifications,
    subscriptions,
    team_members: teamMembers,
    messages: messagesRes.data ?? [],
    reviews: reviewsRes.data ?? [],
    ledger_entries: ledgerRes.data ?? [],
    payout_invoices: invoicesRes.data ?? [],
    connections: connectionsRes.data ?? [],
    notification_preferences: preferencesRes.data ?? null,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="adswish-data-export-${user.id}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
