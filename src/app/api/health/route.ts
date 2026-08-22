import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const HEALTH_TIMEOUT_MS = 5000;

async function checkDatabase(): Promise<{ ok: boolean; detail: string }> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const query = supabase.from("subscription_plans").select("slug").limit(1);
    const timeout = new Promise<{ error: Error }>((resolve) => {
      setTimeout(() => resolve({ error: new Error("timeout") }), HEALTH_TIMEOUT_MS);
    });
    const result = await Promise.race([query, timeout]);
    if ("error" in result && result.error) {
      return { ok: false, detail: "Database unavailable" };
    }
    return { ok: true, detail: "Database reachable" };
  } catch {
    return { ok: false, detail: "Database unavailable" };
  }
}

/**
 * GET /api/health
 *
 * Safe for Vercel/UptimeRobot probes: it returns only service health, never
 * database errors, credentials, or internal configuration.
 */
export async function GET() {
  const checkedAt = new Date().toISOString();
  const database = await checkDatabase();
  const ok = database.ok;

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      service: "adswish",
      checks: {
        application: { ok: true, detail: "Application responding" },
        database,
      },
      checked_at: checkedAt,
    },
    { status: ok ? 200 : 503 },
  );
}
