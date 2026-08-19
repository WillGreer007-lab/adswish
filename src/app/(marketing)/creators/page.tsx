import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Users, Youtube, Instagram, Music2, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Discover creators — Adswish",
  description:
    "Browse verified creators by tier, niche, and follower count. Connect with creators for affiliate campaigns on Adswish.",
  openGraph: {
    title: "Discover creators — Adswish",
    description:
      "Browse verified creators by tier, niche, and follower count. Connect with creators for affiliate campaigns on Adswish.",
    type: "website",
  },
};

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

type CreatorRow = {
  user_id: string;
  display_name: string;
  profile_picture_url: string | null;
  bio: string | null;
  tier: string;
  niches: string[] | null;
  average_rating: number;
  creator_social_accounts: {
    platform: string;
    handle: string;
    follower_count: number | null;
    verified_at: string | null;
  }[];
};

export default async function CreatorsPage() {
  const supabase = await createSupabaseServerClient();

  // Every non-deleted creator with a completed profile is discoverable;
  // verified badges appear only where a connected account is verified.
  const { data: creators } = await supabase
    .from("creator_profiles")
    .select(
      "user_id, display_name, profile_picture_url, bio, tier, niches, average_rating, creator_social_accounts(platform, handle, follower_count, verified_at)",
    )
    .is("deleted_at", null)
    .order("average_rating", { ascending: false })
    .limit(50);

  const rows = (creators ?? []) as CreatorRow[];

  const totalFollowers = (socials: CreatorRow["creator_social_accounts"]) =>
    socials.reduce((sum, s) => sum + (s.follower_count ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Creator Marketplace</p>
        <h1 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">Discover creators</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Browse verified creators by tier and niche, then invite them to your campaign. Every profile shows
          real follower counts pulled straight from their connected accounts.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-center">
          <Users className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">No creators published yet</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Creators appear here once they complete onboarding and verify a social account.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((creator) => {
            const tier = tierConfig[creator.tier] || tierConfig.micro;
            const socials = creator.creator_social_accounts ?? [];
            const total = totalFollowers(socials);
            const verified = socials.filter((s) => s.verified_at);
            return (
              <Link key={creator.user_id} href={`/creators/${creator.user_id}`} className="group">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                        {creator.profile_picture_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={creator.profile_picture_url}
                            alt={creator.display_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Users className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate font-heading text-base font-bold group-hover:text-primary">
                          {creator.display_name}
                        </h2>
                        <p className="text-xs text-muted-foreground">{creator.bio || "Creator on Adswish"}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tier.color}`}>
                        {tier.label} tier
                      </span>
                      {creator.average_rating > 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <Star className="h-3 w-3 fill-warning text-warning" />
                          {creator.average_rating.toFixed(1)}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {total.toLocaleString()} total followers
                      </span>
                    </div>

                    {creator.niches && creator.niches.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {creator.niches.slice(0, 3).map((niche) => (
                          <Badge key={niche} variant="secondary" className="text-[10px]">
                            {niche}
                          </Badge>
                        ))}
                        {creator.niches.length > 3 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{creator.niches.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {verified.length > 0 && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                        {verified.slice(0, 3).map((s) => {
                          const Icon = platformIcons[s.platform] || Users;
                          return (
                            <span
                              key={s.platform}
                              className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success"
                            >
                              <Icon className="h-3 w-3" />
                              @{s.handle}
                              <ShieldCheck className="h-3 w-3" />
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
