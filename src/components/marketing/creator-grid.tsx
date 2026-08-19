"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Users, Youtube, Instagram, Music2, ShieldCheck, Search } from "lucide-react";
import { TIER_META, type Tier } from "@/lib/tier";

const tierConfig = TIER_META;

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  youtube: Youtube,
  instagram: Instagram,
  tiktok: Music2,
};

export type CreatorRow = {
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

type SortMode = "rating" | "followers" | "name";

export function CreatorGrid({ creators }: { creators: CreatorRow[] }) {
  const [tier, setTier] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("rating");

  const allNiches = useMemo(() => {
    const set = new Set<string>();
    for (const c of creators) for (const n of c.niches ?? []) set.add(n);
    return Array.from(set).sort();
  }, [creators]);

  const totalFollowers = (socials: CreatorRow["creator_social_accounts"]) =>
    socials.reduce((sum, s) => sum + (s.follower_count ?? 0), 0);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = creators.filter((c) => {
      if (tier !== "all" && c.tier !== tier) return false;
      if (q) {
        const haystack = [
          c.display_name,
          c.bio ?? "",
          ...(c.niches ?? []),
          ...(c.creator_social_accounts ?? []).map((s) => `${s.platform} ${s.handle}`),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.display_name.localeCompare(b.display_name);
      if (sort === "followers") return totalFollowers(b.creator_social_accounts) - totalFollowers(a.creator_social_accounts);
      return b.average_rating - a.average_rating;
    });
  }, [creators, tier, query, sort]);

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-8 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, niche, or handle…"
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          aria-label="Filter by tier"
        >
          <option value="all">All tiers</option>
          <option value="micro">Small Creator (1K–9.9K)</option>
          <option value="mid">Moderate Creator (10K–99.9K)</option>
          <option value="macro">Big Creator (100K+)</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          aria-label="Sort creators"
        >
          <option value="rating">Sort: rating</option>
          <option value="followers">Sort: followers</option>
          <option value="name">Sort: A–Z</option>
        </select>
      </div>

      {/* Niche chips */}
      {allNiches.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          <Badge
            variant={tier === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setTier("all")}
          >
            All niches
          </Badge>
          {allNiches.map((n) => (
            <Badge
              key={n}
              variant={query === n ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setQuery(query === n ? "" : n)}
            >
              {n}
            </Badge>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-center">
          <Users className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">No creators match your filters</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Try clearing the search or choosing a different tier.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((creator) => {
            const tierInfo = tierConfig[creator.tier as Tier] ?? tierConfig.micro;
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
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tierInfo.color}`}>
                        {tierInfo.label}
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
