import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { parseTelemetryFilter, csvEscape } from "@/lib/telemetry-query";
import { checkRateLimit } from "@/lib/redis";
import { sha256Hex } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 5000;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function GET(request: NextRequest) {
  // The admin page gates access, but exports are the abuse vector, so throttle.
  const ipHash = await sha256Hex(clientIp(request));
  const limit = await checkRateLimit({
    key: `telemetry-export:${ipHash}`,
    limit: 10,
    windowSeconds: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many exports — wait a minute" }, { status: 429 });
  }

  const filter = parseTelemetryFilter({
    kind: request.nextUrl.searchParams.get("kind") ?? undefined,
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    path: request.nextUrl.searchParams.get("path") ?? undefined,
    from: request.nextUrl.searchParams.get("from") ?? undefined,
    to: request.nextUrl.searchParams.get("to") ?? undefined,
  });

  const supabase = createSupabaseServiceRoleClient();

  const header =
    filter.kind === "analytics"
      ? ["created_at", "event", "path", "referrer", "session_id", "user_id"]
      : ["created_at", "message", "source", "path", "user_id", "stack"];

  let rows: Record<string, unknown>[] = [];
  if (filter.kind === "analytics") {
    let query = supabase
      .from("analytics_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);
    if (filter.q) query = query.ilike("event", `%${filter.q}%`);
    if (filter.path) query = query.ilike("path", `%${filter.path}%`);
    if (filter.from) query = query.gte("created_at", filter.from);
    if (filter.to) query = query.lte("created_at", filter.to);
    const { data } = await query;
    rows = (data as Record<string, unknown>[]) ?? [];
  } else {
    let query = supabase
      .from("error_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);
    if (filter.q) query = query.ilike("message", `%${filter.q}%`);
    if (filter.path) query = query.ilike("path", `%${filter.path}%`);
    if (filter.from) query = query.gte("created_at", filter.from);
    if (filter.to) query = query.lte("created_at", filter.to);
    const { data } = await query;
    rows = (data as Record<string, unknown>[]) ?? [];
  }

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(header.map((col) => csvEscape(row[col])).join(","));
  }

  const filename = `telemetry-${filter.kind}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
