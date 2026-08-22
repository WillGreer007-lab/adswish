import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, AlertTriangle, ShieldAlert, FileText, Activity, Gavel, BadgeCheck, MonitorUp } from "lucide-react";
import Link from "next/link";
import { OAuthProviderToggle } from "@/components/admin/oauth-provider-toggle";

export default async function AdminDashboard() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { count: creatorCount } = await supabase
    .from("creator_profiles")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);

  const { count: businessCount } = await supabase
    .from("business_profiles")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);

  const { count: openDisputes } = await supabase
    .from("sla_disputes")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");

  const { count: reportedReviews } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .not("reported_by", "is", null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-background">Superadmin</h1>
        <p className="text-sm text-background/60">System overview and management</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-surface/5 border-background/10">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-background/60">Creators</p>
                <p className="mt-2 font-mono text-2xl font-bold text-background">{creatorCount || 0}</p>
              </div>
              <Users className="h-8 w-8 text-background/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/5 border-background/10">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-background/60">Businesses</p>
                <p className="mt-2 font-mono text-2xl font-bold text-background">{businessCount || 0}</p>
              </div>
              <DollarSign className="h-8 w-8 text-background/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/5 border-background/10">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-background/60">Open disputes</p>
                <p className="mt-2 font-mono text-2xl font-bold text-background">{openDisputes || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-background/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface/5 border-background/10">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-background/60">Reported reviews</p>
                <p className="mt-2 font-mono text-2xl font-bold text-background">{reportedReviews || 0}</p>
              </div>
              <ShieldAlert className="h-8 w-8 text-background/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/users">
          <Card className="bg-surface/5 border-background/10 hover:bg-surface/10 transition-colors">
            <CardHeader>
              <CardTitle className="text-background">Entity Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-background/60">Full user directory, 360° view, strike/ban controls</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/audit-logs">
          <Card className="bg-surface/5 border-background/10 hover:bg-surface/10 transition-colors">
            <CardHeader>
              <CardTitle className="text-background flex items-center gap-2">
                <FileText className="h-5 w-5" /> Audit Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-background/60">Immutable admin action log viewer</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/manual-verifications">
          <Card className="bg-surface/5 border-background/10 hover:bg-surface/10 transition-colors">
            <CardHeader>
              <CardTitle className="text-background flex items-center gap-2">
                <BadgeCheck className="h-5 w-5" /> Follower Verification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-background/60">Review creator TikTok, Instagram, and YouTube screenshots</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/telemetry">
          <Card className="bg-surface/5 border-background/10 hover:bg-surface/10 transition-colors">
            <CardHeader>
              <CardTitle className="text-background flex items-center gap-2">
                <Activity className="h-5 w-5" /> Telemetry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-background/60">First-party analytics and crash reporting</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/uptime">
          <Card className="bg-surface/5 border-background/10 hover:bg-surface/10 transition-colors">
            <CardHeader>
              <CardTitle className="text-background flex items-center gap-2">
                <MonitorUp className="h-5 w-5" /> Uptime monitoring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-background/60">Credential health, monitor history, and incidents</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/sla">
          <Card className="bg-surface/5 border-background/10 hover:bg-surface/10 transition-colors">
            <CardHeader>
              <CardTitle className="text-background flex items-center gap-2">
                <Gavel className="h-5 w-5" /> SLA Command Center
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-background/60">Open disputes, holds, and resolutions</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/fraud">
          <Card className="bg-surface/5 border-background/10 hover:bg-surface/10 transition-colors">
            <CardHeader>
              <CardTitle className="text-background flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" /> Fraud Feed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-background/60">Click bursts, high-value conversions, flagged reviews</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="space-y-3">
        <h2 className="font-heading text-lg font-semibold text-background">OAuth providers</h2>
        <OAuthProviderToggle />
      </div>
    </div>
  );
}
