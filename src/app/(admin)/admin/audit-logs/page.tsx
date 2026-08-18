import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminAuditLogsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: logs } = await supabase
    .from("admin_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-background">Audit Logs</h1>
        <p className="text-sm text-background/60">
          Immutable record of all admin actions. Read-only.
        </p>
      </div>

      <Card className="bg-surface/5 border-background/10">
        <CardHeader>
          <CardTitle className="text-background">
            Admin Actions ({logs?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs && logs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-background/10 text-left text-background/60">
                    <th className="py-2 pr-4">Admin ID</th>
                    <th className="py-2 pr-4">Action</th>
                    <th className="py-2 pr-4">Target</th>
                    <th className="py-2 pr-4">Metadata</th>
                    <th className="py-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-background/5">
                      <td className="py-3 pr-4 font-mono text-xs text-background/80">{log.admin_id?.slice(0, 8)}...</td>
                      <td className="py-3 pr-4 text-background">{log.action_type.replace(/_/g, " ")}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-background/80">{log.target_entity_id?.slice(0, 8) || "—"}...</td>
                      <td className="py-3 pr-4 text-xs text-background/60">{JSON.stringify(log.metadata)}</td>
                      <td className="py-3 text-background/60">{new Date(log.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-background/60">No admin actions logged yet</p>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border border-background/10 bg-surface/5 p-4">
        <p className="text-xs text-background/40">
          These logs are immutable and written to WORM storage (S3 Object Lock, 7-year retention).
          No delete or edit buttons are available. If an admin is compromised, they cannot delete their own tracks.
        </p>
      </div>
    </div>
  );
}
