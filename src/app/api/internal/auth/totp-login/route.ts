import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/redis";
import { verifyTotp } from "@/lib/totp";
import { findUserByEmail, issueSessionForUser } from "@/lib/totp-auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Log in with the authenticator app instead of a password or email code:
 *   { email, code } -> { access_token, refresh_token }
 * The account must have signed up via the QR flow (totp_credentials row);
 * the 6-digit code from the app is verified against the stored secret.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter the 6-digit code from your authenticator app." },
      { status: 400 },
    );
  }

  const ip = clientIp(request);
  const rl = await checkRateLimit({
    key: `totp-login:${ip}:${email}`,
    limit: 10,
    windowSeconds: 3600,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts — try again later." }, { status: 429 });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return NextResponse.json(
      { error: "No account with this email — sign up first." },
      { status: 404 },
    );
  }

  const service = createSupabaseServiceRoleClient();
  const { data: credential, error: credentialErr } = await service
    .from("totp_credentials")
    .select("secret")
    .eq("user_id", user.id)
    .maybeSingle();
  if (credentialErr || !credential) {
    return NextResponse.json(
      { error: "This account doesn't use authenticator sign-in — use your password or a one-time code." },
      { status: 404 },
    );
  }

  if (!verifyTotp(credential.secret, code)) {
    return NextResponse.json(
      { error: "That code didn't match — check the current 6-digit code in your app." },
      { status: 400 },
    );
  }

  const session = await issueSessionForUser(user.id, email);
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: 500 });
  }
  return NextResponse.json(session.session);
}
