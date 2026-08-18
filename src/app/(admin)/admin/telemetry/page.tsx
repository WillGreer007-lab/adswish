import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseTelemetryFilter } from "@/lib/telemetry-query";

export const dynamic = "force-dynamic";

const PAGE_LIMIT = 200;

export default async function AdminTelemetryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filter = parseTelemetryFilter(await searchParams);
  const supabase = createSupabaseServiceRoleClient();

  let rows: any[] = [];
  if (filter.kind === "analytics") {
    let query = supabase
      .from("analytics_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PAGE_LIMIT);
    if (filter.q) query = query.ilike("event", `%${filter.q}%`);
    if (filter.path) query = query.ilike("path", `%${filter.path}%`);
    if (filter.from) query = query.gte("created_at", filter.from);
    if (filter.to) query = query.lte("created_at", filter.to);
    const { data } = await query;
    rows = data ?? [];
  } else {
    let query = supabase
      .from("error_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PAGE_LIMIT);
    if (filter.q) query = query.ilike("message", `%${filter.q}%`);
    if (filter.path) query = query.ilike("path", `%${filter.path}%`);
    if (filter.from) query = query.gte("created_at", filter.from);
    if (filter.to) query = query.lte("created_at", filter.to);
    const { data } = await query;
    rows = data ?? [];
  }

  const exportParams = new URLSearchParams({ kind: filter.kind });
  if (filter.q) exportParams.set("q", filter.q);
  if (filter.path) exportParams.set("path", filter.path);
  if (filter.from) exportParams.set("from", filter.from.slice(0, 10));
  if (filter.to) exportParams.set("to", filter.to.slice(0, 10));
  const exportUrl = `/api/internal/telemetry/export?${exportParams.toString()}`;

  const inputCls =
    "rounded-md border border-background/20 bg-background/5 px-3 py-2 text-sm text-background placeholder:text-background/40 focus:border-background/40 focus:outline-none";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-background">Telemetry</h1>
        <p className="text-sm text-background/60">
          First-party analytics and crash reporting. Filter, or export the
          matching rows as CSV.
        </p>
      </div>

      <Card className="bg-surface/5 border-background/10">
        <CardContent className="p-5">
          <form method="GET" action="/admin/telemetry" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-background/60">Type</span>
              <select name="kind" defaultValue={filter.kind} className={inputCls}>
                <option value="analytics">Events</option>
                <option value="error">Errors</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-background/60">
                {filter.kind === "error" ? "Message contains" : "Event contains"}
              </span>
              <input name="q" defaultValue={filter.q} placeholder="e.g. page_view" className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-background/60">Path contains</span>
              <input name="path" defaultValue={filter.path} placeholder="e.g. /dashboard" className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-background/60">From</span>
              <input type="date" name="from" defaultValue={filter.from?.slice(0, 10)} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-background/60">To</span>
              <input type="date" name="to" defaultValue={filter.to?.slice(0, 10)} className={inputCls} />
            </label>
            <button
              type="submit"
              className="rounded-md bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-background/90"
            >
              Apply
            </button>
            <a
              href={exportUrl}
              download
              className="rounded-md border border-background/20 px-4 py-2 text-sm font-medium text-background hover:bg-background/10"
            >
              Export CSV
            </a>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-surface/5 border-background/10">
        <CardHeader>
          <CardTitle className="text-background">
            {filter.kind === "error" ? "Errors" : "Events"} ({rows.length}
            {rows.length >= PAGE_LIMIT ? "+" : ""})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-background/10 text-left text-background/60">
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">{filter.kind === "error" ? "Message" : "Event"}</th>
                    <th className="py-2 pr-4">Path</th>
                    <th className="py-2 pr-4">Source</th>
                    <th className="py-2">User</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.id} className="border-b border-background/5 align-top">
                      <td className="py-3 pr-4 text-background/60">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="py-3 pr-4 text-background">{r.event ?? r.message}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-background/80">{r.path || "—"}</td>
                      <td className="py-3 pr-4 text-xs text-background/60">{r.source || r.referrer || "—"}</td>
                      <td className="py-3 font-mono text-xs text-background/80">
                        {r.user_id ? r.user_id.slice(0, 8) + "…" : "anon"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-background/60">No matching rows</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
