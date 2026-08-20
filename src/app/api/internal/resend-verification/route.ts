import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** Re-send the signup confirmation email (verify-email page "Resend" button). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not resend the verification email" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
