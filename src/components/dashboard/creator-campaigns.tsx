"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Star, CheckCircle2, AlertTriangle, Link2 } from "lucide-react";

interface CampaignRef {
  id: string;
  title: string;
  type: "fixed" | "affiliate" | "hybrid";
  business_id: string;
  status: string;
}

interface ApplicationRow {
  id: string;
  campaign_id: string;
  campaigns: CampaignRef;
}

interface DeliverableRow {
  id: string;
  campaign_id: string;
  creator_id: string;
  slot_number: number;
  required_hashtag: string;
  deadline_date: string;
  submitted_url: string | null;
  hashtag_verified: boolean;
  business_approved: boolean;
  status: string;
  moderation_status?: string;
}

const statusLabel: Record<string, string> = {
  pending: "Pending",
  grace_period: "Grace period",
  pending_business_review: "Awaiting review",
  completed: "Approved",
  kicked: "Kicked",
  dropped_by_business: "Dropped",
  auto_dropped_sla: "Dropped (SLA)",
};

const statusStyle: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  grace_period: "bg-warning/10 text-warning",
  pending_business_review: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  kicked: "bg-destructive/10 text-destructive",
  dropped_by_business: "bg-destructive/10 text-destructive",
  auto_dropped_sla: "bg-destructive/10 text-destructive",
};

const terminal = new Set(["completed", "kicked", "dropped_by_business", "auto_dropped_sla"]);

export function CreatorCampaignList({
  applications,
  deliverables,
}: {
  applications: ApplicationRow[];
  deliverables: DeliverableRow[];
}) {
  const router = useRouter();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byCampaign = new Map<string, DeliverableRow[]>();
  for (const d of deliverables) {
    if (!byCampaign.has(d.campaign_id)) byCampaign.set(d.campaign_id, []);
    byCampaign.get(d.campaign_id)!.push(d);
  }

  async function submitDeliverable(id: string) {
    const url = (urls[id] || "").trim();
    if (!url) return;
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/internal/deliverables/${id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submitted_url: url }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "Submission failed");
    else router.refresh();
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {applications.map((app) => {
        const items = (byCampaign.get(app.campaign_id) || []).sort((a, b) => a.slot_number - b.slot_number);
        const done = items.filter((d) => terminal.has(d.status)).length;
        const complete = items.length > 0 && items.every((d) => terminal.has(d.status));

        return (
          <Card key={app.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{app.campaigns.title}</CardTitle>
                <Badge variant="secondary">{app.campaigns.type}</Badge>
              </div>
              {items.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex h-2 flex-1 gap-0.5 overflow-hidden rounded-full">
                    {items.map((d) => (
                      <div
                        key={d.id}
                        className={terminal.has(d.status) ? "flex-1 bg-success" : d.status === "grace_period" ? "flex-1 bg-warning" : "flex-1 bg-muted"}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {done}/{items.length}
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Your deliverable slots will appear here.</p>
              ) : (
                items.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg glass-badge text-xs font-bold text-primary">
                          {d.slot_number}
                        </span>
                        <span className="font-mono text-xs">{d.required_hashtag}</span>
                      </div>
                      <Badge className={statusStyle[d.status] ?? "bg-muted text-muted-foreground"}>
                        {statusLabel[d.status] ?? d.status}
                      </Badge>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                      Due {new Date(d.deadline_date).toLocaleDateString()}
                    </p>

                    {d.submitted_url ? (
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                        <a href={d.submitted_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <Link2 className="h-3 w-3" /> View submission
                        </a>
                        <span className={d.hashtag_verified ? "text-success" : "text-warning"}>
                          {d.hashtag_verified ? "✓ hashtag verified" : "hashtag not found — manual review"}
                        </span>
                        {d.moderation_status === "flagged" && (
                          <span className="flex items-center gap-1 text-warning">
                            <AlertTriangle className="h-3 w-3" /> Flagged for review
                          </span>
                        )}
                      </div>
                    ) : (
                      (d.status === "pending" || d.status === "grace_period") && (
                        <div className="mt-3 flex gap-2">
                          <Input
                            placeholder="Paste your post URL"
                            value={urls[d.id] || ""}
                            onChange={(e) => setUrls((prev) => ({ ...prev, [d.id]: e.target.value }))}
                            className="flex-1"
                          />
                          <Button
                            size="sm"
                            onClick={() => submitDeliverable(d.id)}
                            disabled={busy === d.id || !(urls[d.id] || "").trim()}
                          >
                            {busy === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Submit"}
                          </Button>
                        </div>
                      )
                    )}

                    {d.business_approved && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 className="h-3 w-3" /> Approved
                      </p>
                    )}
                  </div>
                ))
              )}

              {complete && <RateBusiness campaign={app.campaigns} />}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RateBusiness({ campaign }: { campaign: CampaignRef }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!rating) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/internal/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewee_id: campaign.business_id,
        campaign_id: campaign.id,
        rating_out_of_5: rating,
        written_feedback: feedback || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "Failed to submit review");
    else router.refresh();
    setSubmitting(false);
  }

  return (
    <div className="mt-3 rounded-lg border border-dashed border-border p-3">
      <p className="text-sm font-medium">Rate this business</p>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
            <Star className={n <= rating ? "h-5 w-5 fill-warning text-warning" : "h-5 w-5 text-muted-foreground"} />
          </button>
        ))}
      </div>
      <textarea
        className="mt-2 flex w-full rounded-md border border-input bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Optional feedback"
        rows={2}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
      <Button size="sm" className="mt-2" onClick={submit} disabled={submitting || !rating}>
        {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Submit review"}
      </Button>
    </div>
  );
}
