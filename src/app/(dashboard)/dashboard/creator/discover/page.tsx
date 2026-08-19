"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardShell, EmptyState } from "@/components/dashboard/dashboard-shell";
import { Loader2, Search, Megaphone, Bookmark, Filter, Save, Trash2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Campaign {
  id: string;
  title: string;
  type: "fixed" | "affiliate" | "hybrid";
  commission_pct: number | null;
  fixed_amount: number | null;
  attribution_days: number | null;
  budget_cap: number | null;
  niche: string[];
  business_profiles: {
    company_name: string;
    logo_url: string | null;
    average_rating: number;
    verified_domain: string | null;
  };
}

const typeConfig = {
  fixed: { badge: "paymentFixed" as const, label: "Fixed" },
  affiliate: { badge: "paymentAffiliate" as const, label: "Affiliate" },
  hybrid: { badge: "paymentHybrid" as const, label: "Hybrid" },
};

export default function DiscoverPage() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [applying, setApplying] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [planLimitError, setPlanLimitError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [minCommission, setMinCommission] = useState("");
  const [maxCommission, setMaxCommission] = useState("");
  const [minRating, setMinRating] = useState("");
  const [attributionDays, setAttributionDays] = useState("");
  const [nicheFilter, setNicheFilter] = useState("");
  const [presets, setPresets] = useState<{ id: string; name: string; filters: Record<string, string> }[]>([]);
  const [presetName, setPresetName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    async function loadData() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("creator_profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();
      setUserName(profile?.display_name || "Creator");

      const { data: campaigns, error } = await supabase
        .from("campaigns")
        .select(`
          id, title, type, commission_pct, fixed_amount, attribution_days, budget_cap, niche,
          business_profiles!inner(company_name, logo_url, average_rating, verified_domain)
        `)
        .eq("visibility", "public")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        setError(error.message);
      } else {
        // to-one embedded relation typed as array by supabase-js — normalize.
        const normalized = (campaigns || []).map((c: any) => ({
          ...c,
          business_profiles: Array.isArray(c.business_profiles) ? c.business_profiles[0] : c.business_profiles,
        }));
        setCampaigns(normalized);
      }

      const { data: savedCampaigns } = await supabase
        .from("saved_campaigns")
        .select("campaign_id")
        .eq("creator_id", user.id);
      setSaved(new Set((savedCampaigns || []).map((s) => s.campaign_id)));

      const presetsRes = await fetch("/api/internal/filter-presets?role=creator");
      if (presetsRes.ok) {
        const presetsData = await presetsRes.json();
        setPresets(presetsData.presets || []);
      }

      setLoading(false);
    }
    loadData();
  }, []);

  async function handleApply(campaignId: string) {
    if (!userId) return;
    setApplying(campaignId);
    setError(null);

    const response = await fetch("/api/internal/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_id: campaignId }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message: string = data.error || "Could not apply";
      if (/limit|upgrade/i.test(message)) {
        setPlanLimitError(message);
        setError(null);
      } else {
        setError(message);
        setPlanLimitError(null);
      }
      setApplying(null);
      return;
    }

    setError(null);
    setPlanLimitError(null);
    setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    setApplying(null);
  }

  async function handleSave(campaignId: string) {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();

    if (saved.has(campaignId)) {
      await supabase.from("saved_campaigns").delete().eq("campaign_id", campaignId).eq("creator_id", userId);
      setSaved((prev) => {
        const next = new Set(prev);
        next.delete(campaignId);
        return next;
      });
    } else {
      await supabase.from("saved_campaigns").insert({ creator_id: userId, campaign_id: campaignId });
      setSaved((prev) => new Set(prev).add(campaignId));
    }
  }

  function currentFilters() {
    return {
      type: filterType,
      q: searchQuery,
      min_commission: minCommission,
      max_commission: maxCommission,
      min_rating: minRating,
      attribution_days: attributionDays,
      niche: nicheFilter,
    };
  }

  async function handleSavePreset() {
    if (!presetName.trim()) return;
    const res = await fetch("/api/internal/filter-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: presetName.trim(), role: "creator", filters: currentFilters() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to save preset");
      return;
    }
    setPresets((prev) => [data.preset, ...prev]);
    setPresetName("");
  }

  async function handleDeletePreset(id: string) {
    await fetch(`/api/internal/filter-presets?id=${id}`, { method: "DELETE" });
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  function applyPreset(filters: Record<string, string>) {
    setFilterType(filters.type || "all");
    setSearchQuery(filters.q || "");
    setMinCommission(filters.min_commission || "");
    setMaxCommission(filters.max_commission || "");
    setMinRating(filters.min_rating || "");
    setAttributionDays(filters.attribution_days || "");
    setNicheFilter(filters.niche || "");
  }

  const filtered = campaigns.filter((c) => {
    if (filterType !== "all" && c.type !== filterType) return false;
    if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !c.business_profiles?.company_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (minCommission && (c.commission_pct ?? 0) < parseFloat(minCommission)) return false;
    if (maxCommission && (c.commission_pct ?? 0) > parseFloat(maxCommission)) return false;
    if (minRating && (c.business_profiles?.average_rating ?? 0) < parseFloat(minRating)) return false;
    if (attributionDays && c.attribution_days !== parseInt(attributionDays)) return false;
    if (nicheFilter && !(c.niche || []).some((n) => n.toLowerCase().includes(nicheFilter.toLowerCase()))) return false;
    return true;
  });

  if (loading) {
    return (
      <DashboardShell role="creator" userId={userId || ""} userName={userName}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="creator" userId={userId || ""} userName={userName}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Discover</h1>
          <p className="text-sm text-muted-foreground">Find campaigns to apply to.</p>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search campaigns or businesses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-surface pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {["all", "fixed", "affiliate", "hybrid"].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    filterType === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="Min commission %"
                value={minCommission}
                onChange={(e) => setMinCommission(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-surface px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={maxCommission}
                onChange={(e) => setMaxCommission(e.target.value)}
                className="h-9 w-20 rounded-md border border-input bg-surface px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <input
              type="number"
              min="0"
              max="5"
              step="0.1"
              placeholder="Min business rating"
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-surface px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              type="number"
              min="1"
              max="30"
              placeholder="Attribution days"
              value={attributionDays}
              onChange={(e) => setAttributionDays(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-surface px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              type="text"
              placeholder="Niche (e.g. Beauty)"
              value={nicheFilter}
              onChange={(e) => setNicheFilter(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-surface px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Preset name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="h-9 flex-1 rounded-md border border-input bg-surface px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button size="sm" variant="outline" onClick={handleSavePreset} disabled={!presetName.trim()}>
                <Save className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {presets.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Saved:</span>
              {presets.map((p) => (
                <span key={p.id} className="flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-xs">
                  <button onClick={() => applyPreset(p.filters)} className="font-medium hover:text-primary">
                    {p.name}
                  </button>
                  <button onClick={() => handleDeletePreset(p.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {planLimitError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">{planLimitError}</p>
            </div>
            <Link
              href="/dashboard/creator/plan"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark"
            >
              Upgrade plan
            </Link>
          </div>
        )}

        {/* Campaign grid */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns found"
            description="New campaigns appear here when businesses publish them."
            ctaLabel="Refresh"
            ctaHref="/dashboard/creator/discover"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((campaign) => (
              <Card key={campaign.id} className="card-lift">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant={typeConfig[campaign.type].badge}>
                      {typeConfig[campaign.type].label}
                    </Badge>
                    <button onClick={() => handleSave(campaign.id)} className="text-muted-foreground hover:text-primary transition-colors">
                      <Bookmark className={cn("h-4 w-4", saved.has(campaign.id) && "fill-primary text-primary")} />
                    </button>
                  </div>

                  <h3 className="font-heading text-sm font-semibold truncate">{campaign.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {campaign.business_profiles?.company_name}
                    {campaign.business_profiles?.verified_domain && " ✓"}
                  </p>

                  <div className="mt-3 flex items-center gap-3 text-xs">
                    {campaign.fixed_amount && (
                      <span className="font-mono font-bold">${campaign.fixed_amount}</span>
                    )}
                    {campaign.commission_pct && (
                      <span className="font-mono font-bold">{campaign.commission_pct}%</span>
                    )}
                    {campaign.attribution_days && (
                      <span className="text-muted-foreground">{campaign.attribution_days}d attribution</span>
                    )}
                    {campaign.business_profiles?.average_rating > 0 && (
                      <span className="text-muted-foreground">★ {campaign.business_profiles.average_rating.toFixed(1)}</span>
                    )}
                  </div>

                  {campaign.niche && campaign.niche.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {campaign.niche.slice(0, 3).map((n) => (
                        <span key={n} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{n}</span>
                      ))}
                    </div>
                  )}

                  <Button
                    size="sm"
                    className="mt-4 w-full btn-slide"
                    onClick={() => handleApply(campaign.id)}
                    disabled={applying === campaign.id}
                  >
                    {applying === campaign.id ? <><Loader2 className="h-3 w-3 animate-spin" /> Applying...</> : "Apply"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
