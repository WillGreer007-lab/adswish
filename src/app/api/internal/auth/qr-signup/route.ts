import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/redis";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";
import {
  createTotpUser,
  findUserByEmail,
  issueSessionForUser,
} from "@/lib/totp-auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function parseBody(body: Record<string, unknown>) {
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role;
  const code = typeof body.code === "string" ? body.code.trim() : "";
  return { email, role, code };
}

/**
 * QR-code signup fallback — for when the confirmation/OTP email can't be
 * delivered. Flow:
 *   1. start:  { email, role } -> { secret, qr_data }  (stored in totp_pending)
 *   2. complete: { email, code } -> { access_token, refresh_token }
 * The user scans the QR with any authenticator app and enters the 6-digit
 * code; the code replaces email proof. No email is ever sent.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { email, role, code } = parseBody(body);
  const action = body.action;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const service = createSupabaseServiceRoleClient();
  const ip = clientIp(request);

  if (action === "start") {
    if (role !== "creator" && role !== "business") {
      return NextResponse.json({ error: "Choose whether you're joining as a creator or a business." }, { status: 400 });
    }

    const rl = await checkRateLimit({
      key: `qr-signup-start:${ip}:${email}`,
      limit: 5,
      windowSeconds: 3600,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many attempts — try again later." }, { status: 429 });
    }

    // Refuse to start when the account already exists.
    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists — log in instead." },
        { status: 409 },
      );
    }

    const secret = generateTotpSecret();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error: pendingErr } = await service
      .from("totp_pending")
      .upsert(
        { email, secret, role, created_at: new Date().toISOString(), expires_at: expiresAt },
        { onConflict: "email" },
      );
    if (pendingErr) {
      return NextResponse.json({ error: "Could not prepare the QR code — try again." }, { status: 500 });
    }

    const qrData = await QRCode.toDataURL(otpauthUri(email, secret), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
    });

    return NextResponse.json({ secret, qr_data: qrData });
  }

  if (action === "complete") {
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Enter the 6-digit code from your authenticator app." }, { status: 400 });
    }

    const rl = await checkRateLimit({
      key: `qr-signup-complete:${email}`,
      limit: 10,
      windowSeconds: 3600,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many attempts — try again later." }, { status: 429 });
    }

    const { data: pending, error: pendingErr } = await service
      .from("totp_pending")
      .select("email, secret, role, expires_at")
      .eq("email", email)
      .maybeSingle();
    if (pendingErr || !pending) {
      return NextResponse.json(
        { error: "QR session expired or not found — tap the QR button again." },
        { status: 410 },
      );
    }
    if (new Date(pending.expires_at).getTime() < Date.now()) {
      await service.from("totp_pending").delete().eq("email", email);
      return NextResponse.json(
        { error: "That QR code expired — tap the QR button to get a fresh one." },
        { status: 410 },
      );
    }

    if (!verifyTotp(pending.secret, code)) {
      return NextResponse.json(
        { error: "That code didn't match — check the current 6-digit code in your app." },
        { status: 400 },
      );
    }

    const created = await createTotpUser({
      email,
      role: pending.role as "creator" | "business",
      secret: pending.secret,
    });
    if ("error" in created) {
      // Either way the pending secret is spent.
      await service.from("totp_pending").delete().eq("email", email);
      return NextResponse.json(
        { error: created.error },
        { status: created.code === "email_in_use" ? 409 : 500 },
      );
    }

    await service.from("totp_pending").delete().eq("email", email);

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "Account created, but the session couldn't start — log in with your authenticator." }, { status: 500 });
    }

    const session = await issueSessionForUser(user.id, email);
    if ("error" in session) {
      return NextResponse.json({ error: session.error }, { status: 500 });
    }
    return NextResponse.json(session.session);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
