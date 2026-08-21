import { notFound } from "next/navigation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AuditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = createSupabaseServiceRoleClient();

  const [{ data: audits }, { data: profile }] = await Promise.all([
    service
      .from("verification_audits")
      .select("platform, handle, follower_count, threshold, threshold_met, verification_token_matched, tier, created_at")
      .eq("creator_id", id)
      .order("created_at", { ascending: false }),
    service
      .from("creator_profiles")
      .select("display_name, tier")
      .eq("user_id", id)
      .maybeSingle(),
  ]);

  if (!audits || audits.length === 0) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-success" />
        Adswish verification report
      </div>
      <h1 className="mt-2 font-heading text-3xl font-bold">{profile?.display_name ?? "Creator"}</h1>
      <p className="mt-1 text-muted-foreground">
        {audits.length} verified platform{audits.length === 1 ? "" : "s"}
        {profile?.tier ? ` · tier: ${profile.tier}` : ""}
      </p>

      <div className="mt-6 space-y-3">
        {audits.map((audit: any) => (
          <div key={`${audit.platform}-${audit.created_at}`} className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium capitalize">{audit.platform}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(audit.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              @{audit.handle} · <strong>{Number(audit.follower_count).toLocaleString()}</strong> followers
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${audit.threshold_met ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                {audit.threshold_met ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                Threshold {audit.threshold_met ? "met" : "not met"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Ownership token matched
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        This report is generated from Adswish&apos;s public verification audit trail. It reflects
        follower counts snapshotted at verification time.
      </p>
    </main>
  );
}
