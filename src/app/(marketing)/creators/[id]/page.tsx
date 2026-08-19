import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Users, Video, Youtube, Instagram, Music2, ShieldCheck } from "lucide-react";

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

const tierConfig: Record<string, { label: string; color: string }> = {
  micro: { label: "Micro", color: "bg-muted text-muted-foreground" },
  mid: { label: "Mid", color: "bg-primary/10 text-primary" },
  macro: { label: "Macro", color: "bg-warning/10 text-warning" },
};

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
    .select("id, rating_out_of_5, written_feedback, creator_response, created_at, reviewer_id")
    .eq("reviewee_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const planSlug = subscription?.plan_slug || "creator_free";
  const tier = tierConfig[profile.tier] || tierConfig.micro;
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
          <h1 className="font-heading text-2xl font-bold">{fullName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{profile.bio}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${tier.color}`}>
              {tier.label} Tier
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${plan.color}`}>
              {plan.label} Plan
            </span>
            {profile.average_rating > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Star className="h-3 w-3 fill-warning text-warning" />
                {profile.average_rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Niches */}
      {profile.niches && profile.niches.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">Niches</h2>
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
          <h2 className="mb-2 text-sm font-semibold">Connected accounts</h2>
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
        <h2 className="mb-2 text-sm font-semibold">Portfolio</h2>
        <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
          <div className="text-center">
            <Video className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No portfolio videos yet</p>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">
          Reviews ({reviews?.length || 0})
        </h2>
        {reviews && reviews.length > 0 ? (
          <div className="space-y-3">
            {reviews.map((review) => (
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
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {review.written_feedback && (
                    <p className="mt-2 text-sm text-muted-foreground">{review.written_feedback}</p>
                  )}
                  {review.creator_response && (
                    <div className="mt-3 rounded-md bg-muted p-3">
                      <p className="text-xs font-medium text-muted-foreground">Creator response:</p>
                      <p className="mt-1 text-sm">{review.creator_response}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex min-h-20 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
            <p className="text-sm text-muted-foreground">No reviews yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
