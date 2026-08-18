"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

const NICHES = [
  "Beauty", "Fashion", "Fitness", "Food", "Tech", "Gaming",
  "Travel", "Lifestyle", "Comedy", "Music", "Education", "DIY",
  "Parenting", "Pets", "Finance", "Health", "Art", "Photography",
  "Dance", "Sports", "Automotive", "Home Decor", "Sustainability",
  "Books", "Film", "Science", "Outdoor", "Cooking", "Skincare",
  "Haircare", "Jewelry", "Sneakers", "Streetwear", "Luxury",
  "Minimalism", "Productivity", "Startups", "Real Estate", "Investing",
  "Crypto", "AI", "Podcasts", "Smart Home", "Plants", "Garden",
  "Interior Design", "Photography Gear", "Mobile Apps", "SaaS",
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"fixed" | "affiliate" | "hybrid">("fixed");
  const [fixedAmount, setFixedAmount] = useState("");
  const [commissionPct, setCommissionPct] = useState("");
  const [attributionDays, setAttributionDays] = useState("7");
  const [budgetCap, setBudgetCap] = useState("");
  const [visibility, setVisibility] = useState<"public" | "invite" | "unlisted">("public");
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [deliverableCount, setDeliverableCount] = useState(1);
  const [deliverableDeadlines, setDeliverableDeadlines] = useState<string[]>([""]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  function toggleNiche(niche: string) {
    setSelectedNiches((prev) =>
      prev.includes(niche) ? prev.filter((n) => n !== niche) : prev.length >= 5 ? prev : [...prev, niche]
    );
  }

  function updateDeliverableCount(count: number) {
    setDeliverableCount(count);
    setDeliverableDeadlines((prev) => {
      const next = [...prev];
      while (next.length < count) next.push("");
      while (next.length > count) next.pop();
      return next;
    });
  }

  function updateDeadline(index: number, value: string) {
    setDeliverableDeadlines((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function handleSubmit(status: "draft" | "active") {
    setLoading(true);

    const response = await fetch("/api/internal/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        type,
        fixed_amount: fixedAmount ? parseFloat(fixedAmount) : null,
        commission_pct: commissionPct ? parseFloat(commissionPct) : null,
        attribution_days: type !== "fixed" ? parseInt(attributionDays) : null,
        budget_cap: budgetCap ? parseFloat(budgetCap) : null,
        visibility,
        niche: selectedNiches,
        deliverable_count: deliverableCount,
        deliverable_deadlines: deliverableDeadlines.filter((d) => d),
        save_as_template: saveAsTemplate,
        template_name: templateName || null,
        status,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Failed to create campaign");
      setLoading(false);
      return;
    }

    router.push("/dashboard/business");
    router.refresh();
  }

  const typeConfig = {
    fixed: { color: "paymentFixed" as const, label: "Fixed" },
    affiliate: { color: "paymentAffiliate" as const, label: "Affiliate" },
    hybrid: { color: "paymentHybrid" as const, label: "Hybrid" },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Create a Campaign</h1>
        <p className="text-sm text-muted-foreground">Set your terms — fixed, affiliate, or hybrid.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Campaign title</Label>
            <Input id="title" placeholder="e.g. Summer Glow Collection" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="flex w-full rounded-md border border-input bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Describe what you want creators to do..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Payment type</Label>
            <div className="grid grid-cols-3 gap-3">
              {(["fixed", "affiliate", "hybrid"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "flex flex-col items-center rounded-lg border-2 p-3 transition-colors",
                    type === t ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  )}
                >
                  <Badge variant={typeConfig[t].color} className="mb-1">{typeConfig[t].label}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {t === "fixed" ? "$ per post" : t === "affiliate" ? "% per sale" : "$ + % per sale"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {type !== "affiliate" && (
              <div className="space-y-2">
                <Label htmlFor="fixedAmount">Fixed amount ($)</Label>
                <Input id="fixedAmount" type="number" placeholder="500" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} />
              </div>
            )}
            {type !== "fixed" && (
              <div className="space-y-2">
                <Label htmlFor="commission">Commission (%)</Label>
                <Input id="commission" type="number" placeholder="15" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} />
              </div>
            )}
            {type !== "fixed" && (
              <div className="space-y-2">
                <Label htmlFor="attribution">Attribution window (days)</Label>
                <Input id="attribution" type="number" min="1" max="30" placeholder="7" value={attributionDays} onChange={(e) => setAttributionDays(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="budget">Budget cap ($)</Label>
              <Input id="budget" type="number" placeholder="5000" value={budgetCap} onChange={(e) => setBudgetCap(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Visibility</Label>
            <div className="grid grid-cols-3 gap-3">
              {(["public", "invite", "unlisted"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={cn(
                    "rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors",
                    visibility === v ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  )}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Niches (select up to 5)</Label>
            <div className="flex flex-wrap gap-2">
              {NICHES.map((niche) => (
                <button
                  key={niche}
                  type="button"
                  onClick={() => toggleNiche(niche)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    selectedNiches.includes(niche) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50"
                  )}
                >
                  {niche}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{selectedNiches.length}/5 selected</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deliverables ({deliverableCount})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Label>Number of deliverables</Label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => updateDeliverableCount(Math.max(1, deliverableCount - 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-border">−</button>
              <span className="font-mono text-lg font-bold w-8 text-center">{deliverableCount}</span>
              <button type="button" onClick={() => updateDeliverableCount(Math.min(10, deliverableCount + 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-border"><Plus className="h-4 w-4" /></button>
            </div>
          </div>

          {deliverableDeadlines.map((deadline, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg glass-badge text-xs font-bold text-primary">{i + 1}</span>
              <div className="flex-1">
                <Input type="datetime-local" value={deadline} onChange={(e) => updateDeadline(i, e.target.value)} />
              </div>
              <span className="text-xs text-muted-foreground">Deadline</span>
            </div>
          ))}

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
            <span className="text-sm">Save as template</span>
          </label>
          {saveAsTemplate && (
            <Input placeholder="Template name (e.g. 3 posts + 1 story)" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={() => handleSubmit("draft")} disabled={loading || !title}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save as Draft</>}
        </Button>
        <Button className="flex-1 btn-slide" onClick={() => handleSubmit("active")} disabled={loading || !title}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Publishing...</> : "Publish Campaign"}
        </Button>
      </div>
    </div>
  );
}
