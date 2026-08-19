"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Building2, ShieldCheck, Search } from "lucide-react";

const planLabels: Record<string, string> = {
  business_free: "Free",
  business_growth: "Growth",
  business_enterprise: "Enterprise",
};

export type BusinessRow = {
  user_id: string;
  company_name: string;
  logo_url: string | null;
  bio: string | null;
  verified_domain: string | null;
  average_rating: number;
  plan_slug: string;
};

type SortMode = "rating" | "name";

export function BusinessGrid({ businesses }: { businesses: BusinessRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("rating");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = businesses.filter((b) => {
      if (!q) return true;
      return [b.company_name, b.bio ?? "", b.verified_domain ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.company_name.localeCompare(b.company_name);
      return b.average_rating - a.average_rating;
    });
  }, [businesses, query, sort]);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by company, bio, or domain…"
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          aria-label="Sort businesses"
        >
          <option value="rating">Sort: rating</option>
          <option value="name">Sort: A–Z</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-center">
          <Building2 className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">No businesses match your search</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">Try a different company name or keyword.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((b) => (
            <Link key={b.user_id} href={`/businesses/${b.user_id}`} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                      {b.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.logo_url} alt={b.company_name} className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate font-heading text-base font-bold group-hover:text-primary">
                        {b.company_name}
                      </h2>
                      <p className="text-xs text-muted-foreground">{b.bio || "Business on Adswish"}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{planLabels[b.plan_slug] || "Free"} Plan</Badge>
                    {b.average_rating > 0 && (
                      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        {b.average_rating.toFixed(1)}
                      </span>
                    )}
                    {b.verified_domain && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                        <ShieldCheck className="h-3 w-3" />
                        {b.verified_domain}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
