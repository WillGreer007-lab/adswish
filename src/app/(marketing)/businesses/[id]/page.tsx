import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Building2, CheckCircle2, Crown, Globe, ShieldCheck, RefreshCw } from "lucide-react";
import { ConnectButton } from "@/components/dashboard/connect-button";
import { SectionLabel } from "@/components/ui/info-tooltip";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("business_profiles")
    .select("company_name, bio, logo_url")
    .eq("user_id", id)
    .is("deleted_at", null)
    .single();

  if (!profile) return { title: "Business not found — Adswish" };

  const name = profile.company_name || "Business";
  const image = profile.logo_url || undefined;
  return {
    title: `${name} — Adswish business`,
    description: profile.bio || `${name} is a business on Adswish.`,
    openGraph: {
      title: `${name} — Adswish business`,
      description: profile.bio || undefined,
      type: "profile",
      images: image ? [{ url: image, alt: name }] : undefined,
    },
  };
}

const planConfig: Record<string, { label: string; color: string }> = {
  business_free: { label: "Free", color: "bg-muted text-muted-foreground" },
  business_growth: { label: "Growth", color: "bg-primary/10 text-primary" },
  business_enterprise: { label: "Enterprise", color: "bg-payment-hybrid/10 text-payment-hybrid" },
};

/** Compact relative time for the reviews list ("2 days ago" style). */
function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/** Campaign status -> history badge. */
function campaignState(status: string): { label: string; active: boolean } {
  if (status === "completed") return { label: "Completed", active: false };
  if (status === "active" || status === "paused" || status === "paused_budget") {
    return { label: "Active", active: true };
  }
  return { label: "Ended", active: false };
}

export default async function BusinessProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", id)
    .is("deleted_at", null)
    .single();

  if (!profile) notFound();

  const { data: subscription } = await supabase
    .from("business_subscriptions")
    .select("plan_slug")
    .eq("business_id", id)
    .eq("status", "active")
    .single();

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating_out_of_5, written_feedback, creator_response, created_at, reviewer_id, campaign_id")
    .eq("reviewee_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Reviews + campaign history are public profile content (like the creator
  // page's portfolio) and the tables have no public-read RLS policy, so read
  // through the service role and enrich: reviewer = creator display name,
  // campaign title, plus the total review count.
  const service = createSupabaseServiceRoleClient();
  const reviewerMap = new Map<string, string>();
  const reviewerIds = [...new Set((reviews ?? []).map((r) => r.reviewer_id))];
  if (reviewerIds.length > 0) {
    const { data: reviewers } = await service
      .from("creator_profiles")
      .select("user_id, display_name")
      .in("user_id", reviewerIds);
    for (const c of reviewers ?? []) reviewerMap.set(c.user_id, c.display_name);
  }
  const campaignMap = new Map<string, string>();
  const campaignIds = [...new Set((reviews ?? []).map((r) => r.campaign_id))];
  if (campaignIds.length > 0) {
    const { data: reviewCampaigns } = await service
      .from("campaigns")
      .select("id, title")
      .in("id", campaignIds);
    for (const c of reviewCampaigns ?? []) campaignMap.set(c.id, c.title);
  }
  const { count: reviewCount } = await service
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("reviewee_id", id);

  // Campaign history: every campaign this business posted (non-draft).
  const { data: historyRows } = await service
    .from("campaigns")
    .select("id, title, status")
    .eq("business_id", id)
    .is("deleted_at", null)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(8);

  const history: { title: string; status: string }[] = (historyRows ?? []).map(
    (h: { title: string; status: string }) => ({ title: h.title, status: h.status }),
  );

  const planSlug = subscription?.plan_slug || "business_free";
  const plan = planConfig[planSlug] || planConfig.business_free;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
        <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border-2 border-border bg-muted sm:mb-0 sm:mr-6">
          {profile.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logo_url} alt={profile.company_name} className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h1 className="font-heading text-2xl font-bold">{profile.company_name}</h1>
            {profile.verified_badge && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-600"
                title="Paid plan and verified domain"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Verified
              </span>
            )}
            {profile.gold_badge && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-semibold text-amber-600"
                title="Enterprise plan with KYB verified"
              >
                <Crown className="h-3.5 w-3.5" /> Gold
              </span>
            )}
          </div>
          {profile.verified_domain && (
            <p className="mt-1 text-sm font-medium text-muted-foreground">{profile.verified_domain}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{profile.bio}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${plan.color}`}>
              {plan.label} Plan
            </span>
            {profile.average_rating > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Star className="h-3 w-3 fill-warning text-warning" />
                {profile.average_rating.toFixed(1)} ({reviewCount ?? 0} reviews)
              </span>
            )}
          </div>
          <div className="mt-4">
            <ConnectButton targetUserId={id} />
          </div>
        </div>
      </div>

      {/* Connected channels — the verified website */}
      {profile.verified_domain && (
        <div className="mt-6">
          <SectionLabel title="Connected channels" hint="Live channels this business has verified on Adswish." />
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Website</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                    <ShieldCheck className="h-3 w-3" />
                    Active
                  </span>
                </div>
                <a
                  href={`https://${profile.verified_domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-sm font-medium hover:text-primary hover:underline"
                >
                  {profile.verified_domain}
                </a>
                <p className="text-xs text-muted-foreground">Verified tracking domain</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="mt-6">
        <SectionLabel
          title="Recent reviews"
          hint="What creators say after working with this business, with the campaign it came from."
          count={reviewCount ?? 0}
        />
        {reviews && reviews.length > 0 ? (
          <div className="space-y-3">
            {reviews.map((review) => {
              const creatorName = review.reviewer_id ? reviewerMap.get(review.reviewer_id) : undefined;
              const campaignTitle = review.campaign_id ? campaignMap.get(review.campaign_id) : undefined;
              return (
                <Card key={review.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${star <= review.rating_out_of_5 ? "fill-warning text-warning" : "text-border"}`}
                        />
                      ))}
                      <span className="ml-auto text-xs text-muted-foreground">{timeAgo(review.created_at)}</span>
                    </div>
                    {review.written_feedback && (
                      <p className="mt-2 text-sm text-muted-foreground">{review.written_feedback}</p>
                    )}
                    {(creatorName || campaignTitle) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {creatorName && <span className="font-medium text-foreground">{creatorName}</span>}
                        {creatorName && campaignTitle && <span> · </span>}
                        {campaignTitle && <span>{campaignTitle}</span>}
                      </p>
                    )}
                    {review.creator_response && (
                      <div className="mt-3 rounded-md bg-muted p-3">
                        <p className="text-xs font-medium text-muted-foreground">Response:</p>
                        <p className="mt-1 text-sm">{review.creator_response}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-20 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
            <p className="text-sm text-muted-foreground">No reviews yet</p>
          </div>
        )}
      </div>

      {/* Campaign history */}
      <div className="mt-6">
        <SectionLabel title="Campaign history" hint="Campaigns this business has posted on Adswish and their current status." />
        {history.length > 0 ? (
          <div className="space-y-2">
            {history.map((h, i) => {
              const st = campaignState(h.status);
              return (
                <div
                  key={`${h.title}-${i}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-muted/20 px-4 py-3"
                >
                  {st.active ? (
                    <RefreshCw className="h-4 w-4 flex-shrink-0 text-primary" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success" />
                  )}
                  <span className="text-sm font-medium">{h.title}</span>
                  <span
                    className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      st.active ? "bg-primary/10 text-primary" : "bg-success/10 text-success"
                    }`}
                  >
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-20 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
            <p className="text-sm text-muted-foreground">No campaigns yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
