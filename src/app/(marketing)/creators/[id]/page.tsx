import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Users, Video, Youtube, Instagram, Music2, ShieldCheck, CheckCircle2, Crown, RefreshCw } from "lucide-react";
import { TIER_META, type Tier } from "@/lib/tier";
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
    .from("creator_profiles")
    .select("display_name, bio, profile_picture_url, niches")
    .eq("user_id", id)
    .is("deleted_at", null)
    .single();

  if (!profile) return { title: "Creator not found — Adswish" };

  const name = profile.display_name ?? "Creator";
  const niche = Array.isArray(profile.niches) ? (profile.niches[0] as string | undefined) : undefined;
  const description =
    profile.bio ||
    (niche
      ? `${name} is a ${niche} creator on Adswish.`
      : `${name} is a creator on Adswish.`);
  const image = profile.profile_picture_url || undefined;

  return {
    title: `${name} — Adswish creator`,
    description,
    openGraph: {
      title: `${name} — Adswish creator`,
      description,
      type: "profile",
      images: image ? [{ url: image, alt: name }] : undefined,
    },
    twitter: {
      card: "summary",
      title: `${name} — Adswish creator`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

const tierConfig = TIER_META;

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

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  youtube: Youtube,
  instagram: Instagram,
  tiktok: Music2,
};

const platformLabels: Record<string, string> = {
  youtube: "YouTube subscribers",
  instagram: "Instagram followers",
  tiktok: "TikTok followers",
};

const planConfig: Record<string, { label: string; color: string }> = {
  creator_free: { label: "Free", color: "bg-muted text-muted-foreground" },
  creator_pro: { label: "Pro", color: "bg-primary/10 text-primary" },
  creator_premium: { label: "Premium", color: "bg-payment-hybrid/10 text-payment-hybrid" },
};

export default async function CreatorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", id)
    .is("deleted_at", null)
    .single();

  if (!profile) notFound();

  const { data: socialAccounts } = await supabase
    .from("creator_social_accounts")
    .select("*")
    .eq("creator_id", id)
    .is("disconnected_at", null);

  const { data: subscription } = await supabase
    .from("creator_subscriptions")
    .select("plan_slug")
    .eq("creator_id", id)
    .eq("status", "active")
    .single();

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating_out_of_5, written_feedback, creator_response, created_at, reviewer_id, campaign_id")
    .eq("reviewee_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Approved portfolio videos are public profile content. Read them through
  // the service role because deliverables themselves are intentionally not
  // public under RLS; only completed, business-approved videos are exposed.
  const service = createSupabaseServiceRoleClient();
  const { data: portfolio } = await service
    .from("deliverables")
    .select("id, video_url, campaign_id, campaigns(title)")
    .eq("creator_id", id)
    .eq("business_approved", true)
    .not("video_url", "is", null)
    .is("deleted_at", null)
    .order("approved_at", { ascending: false })
    .limit(12);

  // Reviews are public marketplace content (like the portfolio) and the
  // `reviews` table has no public-read RLS policy, so enrich them through the
  // service role with the reviewer's business name + campaign title.
  const reviewerMap = new Map<string, string>();
  const reviewerIds = [...new Set((reviews ?? []).map((r) => r.reviewer_id))];
  if (reviewerIds.length > 0) {
    const { data: reviewers } = await service
      .from("business_profiles")
      .select("user_id, company_name")
      .in("user_id", reviewerIds);
    for (const b of reviewers ?? []) reviewerMap.set(b.user_id, b.company_name);
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

  // Public campaign history: every campaign this creator was ACCEPTED into,
  // with the business name + live status. Read via service role (applications
  // have no public-read RLS policy).
  const { data: historyRows } = await service
    .from("applications")
    .select("campaign_id, decided_at, campaign:campaigns!inner(title, status, business_id, deleted_at)")
    .eq("creator_id", id)
    .eq("status", "accepted")
    .order("decided_at", { ascending: false })
    .limit(8);
  const historyBizIds = [
    ...new Set(
      (historyRows ?? [])
        .map((h: any) => h.campaign?.business_id)
        .filter((v: unknown): v is string => Boolean(v)),
    ),
  ];
  const historyBizMap = new Map<string, string>();
  if (historyBizIds.length > 0) {
    const { data: bizRows } = await service
      .from("business_profiles")
      .select("user_id, company_name")
      .in("user_id", historyBizIds);
    for (const b of bizRows ?? []) historyBizMap.set(b.user_id, b.company_name);
  }
  const history: { title: string; company: string | null; status: string }[] = (
    historyRows ?? []
  )
    .map((h: any) => ({
      title: h.campaign?.title ?? "Adswish campaign",
      company: h.campaign?.business_id ? historyBizMap.get(h.campaign.business_id) ?? null : null,
      status: h.campaign?.status ?? "ended",
    }))
    .filter((h: { status: string }) => h.status !== "draft");

  const handle = socialAccounts?.[0]?.handle ?? null;
  const planSlug = subscription?.plan_slug || "creator_free";
  const tier = tierConfig[profile.tier as Tier] ?? tierConfig.micro;
  const plan = planConfig[planSlug] || planConfig.creator_free;
  const fullName = profile.display_name;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
        <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted sm:mb-0 sm:mr-6">
          {profile.profile_picture_url ? (
            <img src={profile.profile_picture_url} alt={fullName} className="h-full w-full object-cover" />
          ) : (
            <Users className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h1 className="font-heading text-2xl font-bold">{fullName}</h1>
            {profile.verified_badge && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-600"
                title="Identity and plan verified by Adswish"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Verified
              </span>
            )}
            {profile.gold_badge && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-semibold text-amber-600"
                title="1M+ followers on a verified platform"
              >
                <Crown className="h-3.5 w-3.5" /> Gold
              </span>
            )}
          </div>
          {handle && (
            <p className="mt-1 text-sm font-medium text-muted-foreground">@{handle}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{profile.bio}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${tier.color}`}>
              {tier.label}
            </span>
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
            <ConnectButton targetUserId={id} targetHandle={handle} />
          </div>
        </div>
      </div>

      {/* Niches */}
      {profile.niches && profile.niches.length > 0 && (
        <div className="mt-6">
          <SectionLabel title="Niches" hint="Content categories this creator works in." />
          <div className="flex flex-wrap gap-2">
            {profile.niches.map((niche: string) => (
              <Badge key={niche} variant="secondary">{niche}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Social accounts */}
      {socialAccounts && socialAccounts.length > 0 && (
        <div className="mt-6">
          <SectionLabel title="Connected accounts" hint="Live social channels with auto-synced follower counts; Verified means we confirmed the account." />
          <div className="grid gap-3 sm:grid-cols-3">
            {socialAccounts.map((acc) => {
              const Icon = platformIcons[acc.platform] || Users;
              return (
                <Card key={acc.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{acc.platform}</p>
                      </div>
                      {acc.verified_at && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                          <ShieldCheck className="h-3 w-3" />
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-medium">@{acc.handle}</p>
                    <p className="font-mono text-lg font-bold">{acc.follower_count.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{platformLabels[acc.platform] || "followers"}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Portfolio */}
      <div className="mt-6">
        <SectionLabel title="Portfolio" hint="Business-approved campaign videos the creator chose to show publicly." />
        {portfolio && portfolio.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {portfolio.map((item: any) => {
              const campaign = Array.isArray(item.campaigns) ? item.campaigns[0] : item.campaigns;
              return (
                <Card key={item.id}>
                  <CardContent className="p-3">
                    <video controls preload="metadata" src={item.video_url} className="aspect-video w-full rounded-md bg-muted object-cover" />
                    <p className="mt-2 truncate text-sm font-medium">{campaign?.title || "Adswish campaign"}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
            <div className="text-center">
              <Video className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No approved portfolio videos yet</p>
            </div>
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="mt-6">
        <SectionLabel
          title="Reviews"
          hint="Ratings from businesses after campaigns, with the campaign and when it happened."
          count={reviewCount ?? 0}
        />
        {reviews && reviews.length > 0 ? (
          <div className="space-y-3">
            {reviews.map((review) => {
              const company = review.reviewer_id ? reviewerMap.get(review.reviewer_id) : undefined;
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
                      <span className="ml-auto text-xs text-muted-foreground">
                        {timeAgo(review.created_at)}
                      </span>
                    </div>
                    {review.written_feedback && (
                      <p className="mt-2 text-sm text-muted-foreground">{review.written_feedback}</p>
                    )}
                    {(company || campaignTitle) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {company && <span className="font-medium text-foreground">{company}</span>}
                        {company && campaignTitle && <span> · </span>}
                        {campaignTitle && <span>{campaignTitle}</span>}
                      </p>
                    )}
                    {review.creator_response && (
                      <div className="mt-3 rounded-md bg-muted p-3">
                        <p className="text-xs font-medium text-muted-foreground">Creator response:</p>
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
        <SectionLabel title="Campaign history" hint="Campaigns this creator was accepted into, with their current status." />
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
                  {h.company && (
                    <span className="text-sm text-muted-foreground">({h.company})</span>
                  )}
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
