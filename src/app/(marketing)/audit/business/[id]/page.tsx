import { notFound } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { CheckCircle2, XCircle, ShieldCheck, Link2, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  twitter: "Twitter / X",
};

export default async function BusinessAuditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = createSupabaseServiceRoleClient();

  const [{ data: profile }, { data: campaign }] = await Promise.all([
    service.from("business_profiles").select("company_name").eq("user_id", id).maybeSingle(),
    service
      .from("verification_campaigns")
      .select("*")
      .eq("business_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!campaign) notFound();

  const [{ data: platforms }, { data: audit }] = await Promise.all([
    service
      .from("platform_verifications")
      .select(
        "platform, handle, follower_count, follower_threshold, threshold_met, status, token_posted, verified_at",
      )
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: true }),
    service
      .from("verification_campaign_audits")
      .select(
        "overall_score, status, platform_results, manifest_signature_valid, cross_platform_verified, identity_confidence_score, created_at",
      )
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const verifiedCount = (platforms ?? []).filter((p: any) => p.status === "verified").length;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-success" />
        Adswish SocialVerify report
      </div>
      <h1 className="mt-2 flex items-center gap-2 font-heading text-3xl font-bold">
        <Building2 className="h-6 w-6 text-muted-foreground" />
        {profile?.company_name ?? campaign.business_name ?? "Business"}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {verifiedCount} of {platforms?.length ?? 0} platform
        {(platforms?.length ?? 0) === 1 ? "" : "s"} verified
        {campaign.domain ? ` · ${campaign.domain}` : ""}
      </p>

      {audit && (
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-lg border border-border p-4">
          <div>
            <div className="text-3xl font-semibold tabular-nums">{Number(audit.overall_score)}</div>
            <div className="text-xs text-muted-foreground">overall score</div>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="text-sm">
            <div className="font-medium">
              Status:{" "}
              <span
                className={
                  audit.status === "verified"
                    ? "text-success"
                    : audit.status === "pending_review"
                      ? "text-warning"
                      : "text-destructive"
                }
              >
                {audit.status === "verified"
                  ? "Verified"
                  : audit.status === "pending_review"
                    ? "Under review"
                    : "Failed"}
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {audit.cross_platform_verified ? "Cross-platform verified" : "Single platform"} ·{" "}
              identity confidence {Number(audit.identity_confidence_score ?? 0).toFixed(0)}%
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {(platforms ?? []).map((p: any) => (
          <div key={p.platform} className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{PLATFORM_LABELS[p.platform] ?? p.platform}</span>
              <span className="text-xs text-muted-foreground">
                {p.verified_at ? new Date(p.verified_at).toLocaleDateString() : "not verified yet"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              @{String(p.handle).replace(/^@/, "")} · <strong>{Number(p.follower_count).toLocaleString()}</strong> followers
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                  p.threshold_met ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                }`}
              >
                {p.threshold_met ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                Threshold {p.threshold_met ? "met" : "not met"}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                  p.status === "verified" ? "bg-success/10 text-success" : "bg-muted/50 text-muted-foreground"
                }`}
              >
                {p.status === "verified" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {p.status === "verified" ? "Ownership verified" : "Pending verification"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {campaign.domain && (
        <a
          href={`/.well-known/social-verification.json?business_id=${encodeURIComponent(id)}`}
          className="mt-6 inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <Link2 className="h-4 w-4" />
          View the signed domain manifest
        </a>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        This report is generated from Adswish&apos;s public SocialVerify audit trail. Follower
        counts and ownership are snapshotted at verification time; an HMAC-signed manifest is
        published at /.well-known/social-verification.json so anyone can audit it independently.
      </p>
    </main>
  );
}
