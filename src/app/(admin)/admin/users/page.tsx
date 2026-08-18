import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient();

  const { data: creators } = await supabase
    .from("creator_profiles")
    .select("user_id, display_name, tier, account_status, strikes, average_rating, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: businesses } = await supabase
    .from("business_profiles")
    .select("user_id, company_name, account_status, strikes, average_rating, verified_domain, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

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
        <p className="text-sm text-background/60">Entity management — 360° view, strike/ban controls</p>
      </div>

      {/* Creators */}
      <Card className="bg-surface/5 border-background/10">
        <CardHeader>
          <CardTitle className="text-background">Creators ({creators?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {creators && creators.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-background/10 text-left text-background/60">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Tier</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Strikes</th>
                    <th className="py-2 pr-4">Rating</th>
                    <th className="py-2">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {creators.map((c) => (
                    <tr key={c.user_id} className="border-b border-background/5 hover:bg-surface/5">
                      <td className="py-3 pr-4 font-medium text-background">{c.display_name}</td>
                      <td className="py-3 pr-4 text-background/60 capitalize">{c.tier}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={statusColors[c.account_status] || "secondary"}>{c.account_status}</Badge>
                      </td>
                      <td className="py-3 pr-4 font-mono text-background">{c.strikes}</td>
                      <td className="py-3 pr-4 font-mono text-background">{c.average_rating?.toFixed(1)}</td>
                      <td className="py-3 text-background/60">{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-background/60">No creators yet</p>
          )}
        </CardContent>
      </Card>

      {/* Businesses */}
      <Card className="bg-surface/5 border-background/10">
        <CardHeader>
          <CardTitle className="text-background">Businesses ({businesses?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {businesses && businesses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-background/10 text-left text-background/60">
                    <th className="py-2 pr-4">Company</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Strikes</th>
                    <th className="py-2 pr-4">Rating</th>
                    <th className="py-2 pr-4">Domain</th>
                    <th className="py-2">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((b) => (
                    <tr key={b.user_id} className="border-b border-background/5 hover:bg-surface/5">
                      <td className="py-3 pr-4 font-medium text-background">{b.company_name}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={statusColors[b.account_status] || "secondary"}>{b.account_status}</Badge>
                      </td>
                      <td className="py-3 pr-4 font-mono text-background">{b.strikes}</td>
                      <td className="py-3 pr-4 font-mono text-background">{b.average_rating?.toFixed(1)}</td>
                      <td className="py-3 pr-4 text-background/60">{b.verified_domain || "—"}</td>
                      <td className="py-3 text-background/60">{new Date(b.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-background/60">No businesses yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
