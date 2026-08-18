import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { hashIPAddress } from "@/lib/security";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { consent_type, granted, consent_version } = body;

  if (!consent_type || typeof granted !== "boolean") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const userAgent = request.headers.get("user-agent") || "";

  const serviceClient = createSupabaseServiceRoleClient();
  const { error } = await serviceClient.from("consent_logs").insert({
    user_id: user.id,
    consent_type,
    consent_version: consent_version || "1.0",
    granted_at: new Date().toISOString(),
    ip_hash: hashIPAddress(ip),
    user_agent: userAgent,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to log consent" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function createSupabaseServerClient() {
  const { createServerClient } = await import("@supabase/ssr");
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
          }
        },
      },
    },
  );
}
