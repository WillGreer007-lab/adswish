import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SlaActions } from "@/components/admin/sla-actions";

export const dynamic = "force-dynamic";

export default async function AdminSlaPage() {
  const supabase = createSupabaseServiceRoleClient();

  const [{ data: disputes }, { data: holds }, { data: resolved }] = await Promise.all([
    supabase
      .from("sla_disputes")
      .select("*")
      .eq("status", "open")
      .order("opened_at", { ascending: true })
      .limit(100),
    supabase
      .from("conversions")
      .select("id, order_id, order_amount, creator_cut, hold_expires_at, status")
      .eq("status", "pending_hold")
      .order("hold_expires_at", { ascending: true })
      .limit(100),
    supabase
      .from("sla_disputes")
      .select("*")
      .neq("status", "open")
      .order("resolved_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-background">SLA Command Center</h1>
        <p className="text-sm text-background/60">
          Open disputes, holds about to release, and recent resolutions. Financial actions require explicit confirmation and are audit logged.
        </p>
      </div>

      <Card className="bg-surface/5 border-background/10">
        <CardHeader>
          <CardTitle className="text-background">Open disputes ({disputes?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {disputes && disputes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-background/10 text-left text-background/60">
                    <th className="py-2 pr-4">Raised by</th>
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Opened</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {disputes.map((d: any) => (
                    <tr key={d.id} className="border-b border-background/5 align-top">
                      <td className="py-3 pr-4 font-mono text-xs text-background/80">{d.raised_by?.slice(0, 8)}…</td>
                      <td className="py-3 pr-4 text-background">{d.reason}</td>
                      <td className="py-3 pr-4 text-warning">{d.status}</td>
                      <td className="py-3 pr-4 text-background/60">{new Date(d.opened_at).toLocaleString()}</td>
                      <td className="py-3"><SlaActions disputeId={d.id} canSettle={Boolean(d.related_conversion_id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-background/60">No open disputes</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-surface/5 border-background/10">
        <CardHeader>
          <CardTitle className="text-background">
            Pending holds — soonest release first ({holds?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {holds && holds.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-background/10 text-left text-background/60">
                    <th className="py-2 pr-4">Order</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Creator cut (90%)</th>
                    <th className="py-2">Hold expires</th>
                  </tr>
                </thead>
                <tbody>
                  {holds.map((h: any) => (
                    <tr key={h.id} className="border-b border-background/5">
                      <td className="py-3 pr-4 font-mono text-xs text-background/80">{h.order_id}</td>
                      <td className="py-3 pr-4 text-background">£{Number(h.order_amount).toFixed(2)}</td>
                      <td className="py-3 pr-4 text-success">£{Number(h.creator_cut).toFixed(2)}</td>
                      <td className="py-3 text-background/60">{new Date(h.hold_expires_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-background/60">No holds releasing soon</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-surface/5 border-background/10">
        <CardHeader>
          <CardTitle className="text-background">Recently resolved ({resolved?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {resolved && resolved.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-background/10 text-left text-background/60">
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2 pr-4">Resolution</th>
                    <th className="py-2">Resolved</th>
                  </tr>
                </thead>
                <tbody>
                  {resolved.map((d: any) => (
                    <tr key={d.id} className="border-b border-background/5">
                      <td className="py-3 pr-4 text-background">{d.reason}</td>
                      <td className="py-3 pr-4 text-background/80">{d.resolution || "—"}</td>
                      <td className="py-3 text-background/60">
                        {d.resolved_at ? new Date(d.resolved_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-background/60">No resolved disputes yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
