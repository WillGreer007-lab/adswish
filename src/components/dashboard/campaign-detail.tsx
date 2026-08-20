"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Pause,
  Play,
  Star,
  Loader2,
  Link2,
  Flag,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { AmplifyButton } from "@/components/dashboard/google-ads/amplify-button";

interface CampaignRow {
  id: string;
  title: string;
  description: string;
  type: "fixed" | "affiliate" | "hybrid";
  commission_pct: number | null;
  fixed_amount: number | null;
  attribution_days: number | null;
  status: string;
  budget_cap: number | null;
  total_spent: number;
  visibility: string;
  niche: string[];
  end_date: string | null;
  deliverable_count: number;
  deadline_days: number;
}

interface ApplicationRow {
  id: string;
  creator_id: string;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  applied_at: string;
  cover_note: string | null;
  tier_at_application: string;
  creator_profiles: {
    user_id: string;
    display_name: string;
    profile_picture_url: string | null;
    tier: string;
    average_rating: number;
    niches?: string[];
  };
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

const typeBadge = {
  fixed: "paymentFixed" as const,
  affiliate: "paymentAffiliate" as const,
  hybrid: "paymentHybrid" as const,
};

const typeLabel = {
  fixed: "Fixed",
  affiliate: "Affiliate",
  hybrid: "Hybrid",
};

const deliverableStatusStyle: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  grace_period: "bg-warning/10 text-warning",
  pending_business_review: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  kicked: "bg-destructive/10 text-destructive",
  dropped_by_business: "bg-destructive/10 text-destructive",
  auto_dropped_sla: "bg-destructive/10 text-destructive",
};

const deliverableStatusLabel: Record<string, string> = {
  pending: "Pending",
  grace_period: "Grace period",
  pending_business_review: "Awaiting review",
  completed: "Approved",
  kicked: "Kicked",
  dropped_by_business: "Dropped",
  auto_dropped_sla: "Dropped (SLA)",
};

export function CampaignDetail({
  campaign,
  applications,
  deliverables,
}: {
  campaign: CampaignRow;
  applications: ApplicationRow[];
  deliverables: DeliverableRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, url: string, init?: RequestInit) {
    setBusy(key);
    setError(null);
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Request failed");
    } else {
      router.refresh();
    }
    setBusy(null);
  }

  const pendingApps = applications.filter((a) => a.status === "pending");
  const acceptedApps = applications.filter((a) => a.status === "accepted");

  // creator_id -> display name
  const creatorNames = new Map<string, string>();
  for (const app of applications) {
    creatorNames.set(app.creator_id, app.creator_profiles?.display_name ?? "Creator");
  }

  // Group deliverables by creator.
  const byCreator = new Map<string, DeliverableRow[]>();
  for (const d of deliverables) {
    if (!byCreator.has(d.creator_id)) byCreator.set(d.creator_id, []);
    byCreator.get(d.creator_id)!.push(d);
  }

  const terminal = new Set([
    "completed",
    "kicked",
    "dropped_by_business",
    "auto_dropped_sla",
  ]);
  const campaignComplete =
    campaign.status === "completed" ||
    (deliverables.length > 0 && deliverables.every((d) => terminal.has(d.status)));

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Header */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-2xl font-bold">{campaign.title}</h1>
                <Badge variant={typeBadge[campaign.type]}>{typeLabel[campaign.type]}</Badge>
                <Badge variant={campaign.status === "active" ? "success" : "secondary"}>
                  {campaign.status.replace(/_/g, " ")}
                </Badge>
              </div>
              {campaign.description && (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{campaign.description}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {campaign.fixed_amount != null && <span>{formatCurrency(Number(campaign.fixed_amount))} fixed</span>}
                {campaign.commission_pct != null && <span>{campaign.commission_pct}% commission</span>}
                {campaign.attribution_days != null && (
                  <span>{campaign.attribution_days}-day attribution</span>
                )}
                <span>
                  {campaign.deliverable_count} deliverable{campaign.deliverable_count === 1 ? "" : "s"}
                </span>
                <span>{campaign.visibility}</span>
                {campaign.end_date && (
                  <span>Ends {new Date(campaign.end_date).toLocaleDateString()}</span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  run(
                    "pause",
                    "/api/internal/campaigns",
                    {
                      method: "PATCH",
                      body: JSON.stringify({
                        campaign_id: campaign.id,
                        action: campaign.status === "active" ? "pause" : "resume",
                      }),
                    },
                  )
                }
                disabled={busy === "pause" || !["active", "paused"].includes(campaign.status)}
              >
                {busy === "pause" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : campaign.status === "active" ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {campaign.status === "active" ? "Pause" : "Resume"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  run("duplicate", "/api/internal/campaigns", {
                    method: "POST",
                    body: JSON.stringify({ clone_from: campaign.id }),
                  })
                }
                disabled={busy === "duplicate"}
              >
                {busy === "duplicate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                Duplicate
              </Button>
            </div>
          </div>

          {campaign.budget_cap != null && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Budget</span>
                <span className="font-mono">
                  {formatCurrency(Number(campaign.total_spent))} / {formatCurrency(Number(campaign.budget_cap))}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(100, (campaign.total_spent / campaign.budget_cap) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {campaign.niche?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1">
              {campaign.niche.map((n) => (
                <span key={n} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {n}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Applicants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Applicants ({pendingApps.length} pending)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applicants yet.</p>
          ) : (
            applications.map((app) => (
              <div key={app.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{app.creator_profiles?.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {app.tier_at_application} tier · ★ {app.creator_profiles?.average_rating ?? 0}
                  </p>
                  {app.cover_note && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{app.cover_note}</p>
                  )}
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  {app.status === "pending" ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          run(`app-${app.id}`, "/api/internal/applications", {
                            method: "PATCH",
                            body: JSON.stringify({ application_id: app.id, action: "accept" }),
                          })
                        }
                        disabled={busy === `app-${app.id}`}
                      >
                        {busy === `app-${app.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          run(`app-${app.id}`, "/api/internal/applications", {
                            method: "PATCH",
                            body: JSON.stringify({ application_id: app.id, action: "reject" }),
                          })
                        }
                        disabled={busy === `app-${app.id}`}
                      >
                        <XCircle className="h-3 w-3" /> Reject
                      </Button>
                    </>
                  ) : (
                    <Badge
                      variant={
                        app.status === "accepted" ? "success" : app.status === "rejected" ? "destructive" : "secondary"
                      }
                    >
                      {app.status}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Deliverables — lock-and-key, grouped by creator */}
      {byCreator.size === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Accept a creator to unlock their deliverable track.
          </CardContent>
        </Card>
      ) : (
        [...byCreator.entries()].map(([creatorId, items]) => {
          const sorted = [...items].sort((a, b) => a.slot_number - b.slot_number);
          const pendingReview = sorted.filter((d) => d.status === "pending_business_review");
          return (
            <Card key={creatorId}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{creatorNames.get(creatorId) ?? "Creator"}</CardTitle>
                {pendingReview.length > 0 && (
                  <Button
                    size="sm"
                    onClick={() =>
                      run(`bulk-${creatorId}`, "/api/internal/deliverables/bulk-approve", {
                        method: "POST",
                        body: JSON.stringify({ campaign_id: campaign.id, creator_id: creatorId }),
                      })
                    }
                    disabled={busy === `bulk-${creatorId}`}
                  >
                    {busy === `bulk-${creatorId}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Approve all pending ({pendingReview.length})
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {sorted.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg glass-badge text-xs font-bold text-primary">
                          {d.slot_number}
                        </span>
                        <span className="font-mono text-xs">{d.required_hashtag}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.moderation_status === "flagged" && (
                          <span className="flex items-center gap-1 text-xs text-warning">
                            <Flag className="h-3 w-3" /> Flagged
                          </span>
                        )}
                        <Badge className={deliverableStatusStyle[d.status] ?? "bg-muted text-muted-foreground"}>
                          {deliverableStatusLabel[d.status] ?? d.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Due {new Date(d.deadline_date).toLocaleDateString()}</span>
                      {d.submitted_url && (
                        <a
                          href={d.submitted_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Link2 className="h-3 w-3" /> View submission
                        </a>
                      )}
                      {d.submitted_url && (
                        <span className={d.hashtag_verified ? "text-success" : "text-warning"}>
                          {d.hashtag_verified ? "✓ hashtag verified" : "hashtag not found — manual review"}
                        </span>
                      )}
                    </div>

                    {d.status === "pending_business_review" && (
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            run(`del-${d.id}`, `/api/internal/deliverables/${d.id}/approve`, { method: "POST" })
                          }
                          disabled={busy === `del-${d.id}`}
                        >
                          {busy === `del-${d.id}` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          Approve &amp; authorize tracking
                        </Button>
                        {d.moderation_status === "flagged" && (
                          <span className="flex items-center gap-1 text-xs text-warning">
                            <AlertTriangle className="h-3 w-3" /> Review flagged content before approving
                          </span>
                        )}
                      </div>
                    )}

                    {d.business_approved && (
                      <div className="mt-3 flex items-center gap-2">
                        <AmplifyButton />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Rating — when the campaign reaches a terminal state */}
      {campaignComplete && acceptedApps.length > 0 && (
        <RatingSection campaignId={campaign.id} applications={acceptedApps} />
      )}
    </div>
  );
}

function RatingSection({
  campaignId,
  applications,
}: {
  campaignId: string;
  applications: ApplicationRow[];
}) {
  const router = useRouter();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitReview(revieweeId: string) {
    const rating = ratings[revieweeId];
    if (!rating) return;
    setSubmitting(revieweeId);
    setError(null);
    const res = await fetch("/api/internal/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewee_id: revieweeId,
        campaign_id: campaignId,
        rating_out_of_5: rating,
        written_feedback: feedback[revieweeId] || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "Failed to submit review");
    else router.refresh();
    setSubmitting(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rate your creators</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {applications.map((app) => (
          <div key={app.id} className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">{app.creator_profiles?.display_name}</p>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRatings((prev) => ({ ...prev, [app.creator_id]: n }))}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  <Star
                    className={
                      n <= (ratings[app.creator_id] ?? 0)
                        ? "h-5 w-5 fill-warning text-warning"
                        : "h-5 w-5 text-muted-foreground"
                    }
                  />
                </button>
              ))}
            </div>
            <textarea
              className="mt-2 flex w-full rounded-md border border-input bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Optional feedback"
              rows={2}
              value={feedback[app.creator_id] || ""}
              onChange={(e) => setFeedback((prev) => ({ ...prev, [app.creator_id]: e.target.value }))}
            />
            <Button
              size="sm"
              className="mt-2"
              onClick={() => submitReview(app.creator_id)}
              disabled={submitting === app.creator_id || !ratings[app.creator_id]}
            >
              {submitting === app.creator_id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Submit review"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
