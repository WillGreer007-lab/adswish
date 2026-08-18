import { NextResponse, NextRequest } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { createServerClient } = await import("@supabase/ssr");
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    }},
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { domain, method } = await request.json();

  if (!domain || !method) {
    return NextResponse.json({ error: "Missing domain or method" }, { status: 400 });
  }

  let verified = false;

  if (method === "meta") {
    try {
      const response = await fetch(`https://${domain}`, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });
      const html = await response.text();
      const verificationCode = `adswish-verify-${user.id.slice(0, 16)}`;
      verified = html.includes(verificationCode);
    } catch {
      verified = false;
    }
  } else {
    verified = false;
  }

  return NextResponse.json({ verified });
}
