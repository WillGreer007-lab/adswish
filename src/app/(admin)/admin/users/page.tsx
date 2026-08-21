import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminUserActions } from "@/components/admin/admin-user-actions";

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: admin },
  } = await supabase.auth.getUser();

  const { data: creators } = await supabase
    .from("creator_profiles")
    .select("user_id, display_name, tier, account_status, strikes, average_rating, payouts_paused_at, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: businesses } = await supabase
    .from("business_profiles")
    .select("user_id, company_name, account_status, strikes, average_rating, verified_domain, payouts_paused_at, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const [{ data: creatorSubs }, { data: businessSubs }] = await Promise.all([
    supabase.from("creator_subscriptions").select("creator_id, plan_slug, status").limit(1000),
    supabase.from("business_subscriptions").select("business_id, plan_slug, status").limit(1000),
  ]);

  const creatorPlan = new Map((creatorSubs ?? []).map((s) => [s.creator_id, s]));
  const businessPlan = new Map((businessSubs ?? []).map((s) => [s.business_id, s]));

  const statusColors: Record<string, "default" | "secondary" | "destructive" | "success" | "warning"> = {
    active: "success",
    pending: "warning",
    suspended: "warning",
    banned: "destructive",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-background">User Directory</h1>
        <p className="text-sm text-background/60">
          Suspend, ban, cancel plans, pause payments, or terminate creator and business accounts. Every action is audit logged.
        </p>
      </div>

      <Card className="border-background/10 bg-surface/5">
        <CardHeader><CardTitle className="text-background">Creators ({creators?.length || 0})</CardTitle></CardHeader>
        <CardContent>
          {creators && creators.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-background/10 text-left text-background/60">
                  <th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Tier</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Plan</th><th className="py-2 pr-4">Payments</th><th className="py-2 pr-4">Strikes</th><th className="py-2 pr-4">Rating</th><th className="py-2 pr-4">Joined</th><th className="py-2">Actions</th>
                </tr></thead>
                <tbody>{creators.map((creator) => {
                  const plan = creatorPlan.get(creator.user_id);
                  const payoutsPaused = Boolean(creator.payouts_paused_at);
                  return (
                    <tr key={creator.user_id} className="border-b border-background/5 hover:bg-surface/5">
                      <td className="py-3 pr-4 font-medium text-background">{creator.display_name}</td>
                      <td className="py-3 pr-4 capitalize text-background/60">{creator.tier}</td>
                      <td className="py-3 pr-4"><Badge variant={statusColors[creator.account_status] || "secondary"}>{creator.account_status}</Badge></td>
                      <td className="py-3 pr-4 text-background/60">{plan ? `${plan.plan_slug} · ${plan.status}` : "—"}</td>
                      <td className="py-3 pr-4"><Badge variant={payoutsPaused ? "warning" : "success"}>{payoutsPaused ? "Paused" : "Active"}</Badge></td>
                      <td className="py-3 pr-4 font-mono text-background">{creator.strikes}</td>
                      <td className="py-3 pr-4 font-mono text-background">{creator.average_rating?.toFixed(1)}</td>
                      <td className="py-3 pr-4 text-background/60">{new Date(creator.created_at).toLocaleDateString()}</td>
                      <td className="py-3">
                        <AdminUserActions
                          userId={creator.user_id}
                          role="creator"
                          status={creator.account_status}
                          planStatus={plan?.status ?? null}
                          payoutsPaused={payoutsPaused}
                          disabled={creator.user_id === admin?.id}
                        />
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          ) : <p className="text-sm text-background/60">No creators yet</p>}
        </CardContent>
      </Card>

      <Card className="border-background/10 bg-surface/5">
        <CardHeader><CardTitle className="text-background">Businesses ({businesses?.length || 0})</CardTitle></CardHeader>
        <CardContent>
          {businesses && businesses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-background/10 text-left text-background/60">
                  <th className="py-2 pr-4">Company</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Plan</th><th className="py-2 pr-4">Payments</th><th className="py-2 pr-4">Strikes</th><th className="py-2 pr-4">Rating</th><th className="py-2 pr-4">Domain</th><th className="py-2 pr-4">Joined</th><th className="py-2">Actions</th>
                </tr></thead>
                <tbody>{businesses.map((business) => {
                  const plan = businessPlan.get(business.user_id);
                  const payoutsPaused = Boolean(business.payouts_paused_at);
                  return (
                    <tr key={business.user_id} className="border-b border-background/5 hover:bg-surface/5">
                      <td className="py-3 pr-4 font-medium text-background">{business.company_name}</td>
                      <td className="py-3 pr-4"><Badge variant={statusColors[business.account_status] || "secondary"}>{business.account_status}</Badge></td>
                      <td className="py-3 pr-4 text-background/60">{plan ? `${plan.plan_slug} · ${plan.status}` : "—"}</td>
                      <td className="py-3 pr-4"><Badge variant={payoutsPaused ? "warning" : "success"}>{payoutsPaused ? "Paused" : "Active"}</Badge></td>
                      <td className="py-3 pr-4 font-mono text-background">{business.strikes}</td>
                      <td className="py-3 pr-4 font-mono text-background">{business.average_rating?.toFixed(1)}</td>
                      <td className="py-3 pr-4 text-background/60">{business.verified_domain || "—"}</td>
                      <td className="py-3 pr-4 text-background/60">{new Date(business.created_at).toLocaleDateString()}</td>
                      <td className="py-3">
                        <AdminUserActions
                          userId={business.user_id}
                          role="business"
                          status={business.account_status}
                          planStatus={plan?.status ?? null}
                          payoutsPaused={payoutsPaused}
                          disabled={business.user_id === admin?.id}
                        />
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          ) : <p className="text-sm text-background/60">No businesses yet</p>}
        </CardContent>
      </Card>
    </div>
  );
}
