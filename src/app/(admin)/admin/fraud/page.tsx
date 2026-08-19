import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const BURST_THRESHOLD = 10;
const HIGH_VALUE_POUNDS = 1000;

export default async function AdminFraudPage() {
  const supabase = createSupabaseServiceRoleClient();

  const [{ data: clicks }, { data: big }, { data: flagged }] = await Promise.all([
    supabase
      .from("clicks_log")
      .select("ip_hash, tracking_link_id, clicked_at")
      .order("clicked_at", { ascending: false })
      .limit(2000),
    supabase
      .from("conversions")
      .select("id, order_id, order_amount, tracking_link_id, created_at")
      .gte("order_amount", HIGH_VALUE_POUNDS)
      .order("order_amount", { ascending: false })
      .limit(50),
    supabase
      .from("reviews")
      .select("id, reviewee_id, rating_out_of_5, created_at")
      .not("reported_by", "is", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Aggregate click bursts per IP over the last 24h (heuristic fraud signal).
  const byIp: Record<string, number> = {};
  for (const c of (clicks as any[]) ?? []) {
    byIp[c.ip_hash] = (byIp[c.ip_hash] ?? 0) + 1;
  }
  const bursts = Object.entries(byIp)
    .filter(([, n]) => n >= BURST_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-background">Fraud Feed</h1>
        <p className="text-sm text-background/60">
          Heuristic signals: click bursts, high-value conversions, and flagged
          reviews. Read-only; triage manually.
        </p>
      </div>

      <Card className="bg-surface/5 border-background/10">
        <CardHeader>
          <CardTitle className="text-background">
            Click bursts — same IP, recent ({bursts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bursts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-background/10 text-left text-background/60">
                    <th className="py-2 pr-4">IP hash</th>
                    <th className="py-2">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {bursts.map(([ip, n]) => (
                    <tr key={ip} className="border-b border-background/5">
                      <td className="py-3 pr-4 font-mono text-xs text-background/80">{ip}</td>
                      <td className="py-3 text-destructive">{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-background/60">No click bursts detected</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-surface/5 border-background/10">
        <CardHeader>
          <CardTitle className="text-background">
            High-value conversions (≥ £${HIGH_VALUE_POUNDS}) ({big?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {big && big.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-background/10 text-left text-background/60">
                    <th className="py-2 pr-4">Order</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Link</th>
                    <th className="py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {big.map((c: any) => (
                    <tr key={c.id} className="border-b border-background/5">
                      <td className="py-3 pr-4 font-mono text-xs text-background/80">{c.order_id}</td>
                      <td className="py-3 pr-4 text-background">£{Number(c.order_amount).toFixed(2)}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-background/80">
                        {c.tracking_link_id?.slice(0, 8)}…
                      </td>
                      <td className="py-3 text-background/60">{new Date(c.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-background/60">No high-value conversions</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-surface/5 border-background/10">
        <CardHeader>
          <CardTitle className="text-background">Flagged reviews ({flagged?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {flagged && flagged.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-background/10 text-left text-background/60">
                    <th className="py-2 pr-4">Reviewee</th>
                    <th className="py-2 pr-4">Rating</th>
                    <th className="py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {flagged.map((r: any) => (
                    <tr key={r.id} className="border-b border-background/5">
                      <td className="py-3 pr-4 font-mono text-xs text-background/80">
                        {r.reviewee_id?.slice(0, 8)}…
                      </td>
                      <td className="py-3 pr-4 text-background">{r.rating_out_of_5}/5</td>
                      <td className="py-3 text-background/60">{new Date(r.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-background/60">No flagged reviews</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
