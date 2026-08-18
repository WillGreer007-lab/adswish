import { NextRequest, NextResponse } from "next/server";
import { insertTelemetryEvent, parseTelemetryBody } from "@/lib/telemetry-server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/redis";
import { sha256Hex } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  return real?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Unsupported media type" }, { status: 415 });
  }

  // Light per-IP throttle. Fails open if Redis is down.
  const ipHash = await sha256Hex(clientIp(request));
  const limit = await checkRateLimit({
    key: `telemetry:${ipHash}`,
    limit: 120,
    windowSeconds: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseTelemetryBody(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const event = parsed.value;
  event.ip_hash = ipHash;

  try {
    await insertTelemetryEvent(createSupabaseServiceRoleClient(), event);
  } catch {
    // Swallow persistence errors: analytics/errors are best-effort and must
    // never surface a failure to the browser.
    return NextResponse.json({ ok: false }, { status: 202 });
  }

  return NextResponse.json({ ok: true });
}
