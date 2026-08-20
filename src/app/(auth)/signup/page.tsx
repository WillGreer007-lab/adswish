"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, KeyRound, Smartphone, ShieldCheck } from "lucide-react";
import { GoogleIcon } from "@/components/ui/google-icon";
import { MicrosoftIcon } from "@/components/ui/oauth-icons";
import { cn } from "@/lib/utils";

type Role = "creator" | "business" | null;

function SignupComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role");
  const redirect = searchParams.get("redirect") || "/onboarding";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(
    initialRole === "creator" || initialRole === "business" ? initialRole : null
  );
  const [agreedToMSA, setAgreedToMSA] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  // Authenticator (QR) sign-up fallback — for when the email code never arrives.
  const [qrStarted, setQrStarted] = useState(false);
  const [qrSecret, setQrSecret] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState("");
  const [qrLoading, setQrLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!role) {
      setError("Please select whether you are joining as a creator or a business.");
      return;
    }
    if (!agreedToMSA || !agreedToPrivacy) {
      setError("You must agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // The email is embedded so the callback can verify the account even
        // when the link is opened in a different browser (PKCE code verifier
        // lives in the original browser's cookies).
        emailRedirectTo: `${window.location.origin}/auth/callback?email=${encodeURIComponent(email)}`,
        data: { role },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setConfirmationSent(true);
    setLoading(false);
  }

  async function handleGoogleSignIn() {
    if (!role) {
      setError("Please select whether you are joining as a creator or a business.");
      return;
    }
    if (!agreedToMSA || !agreedToPrivacy) {
      setError("You must agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setGoogleLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding&role=${role}`,
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  }

  /** One-time code sign-up — no password, account is created on first code. */
  async function handleOtpRequest() {
    if (!role) {
      setError("Please select whether you are joining as a creator or a business.");
      return;
    }
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    setOtpLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: { role },
        emailRedirectTo: `${window.location.origin}/auth/callback?email=${encodeURIComponent(email)}`,
      },
    });
    setOtpLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setOtpSent(true);
  }

  /** Start the QR sign-up: get a TOTP secret + QR from the server. */
  async function handleQrStart() {
    if (!role) {
      setError("Please select whether you are joining as a creator or a business.");
      return;
    }
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    setQrLoading(true);
    setError(null);
    const res = await fetch("/api/internal/auth/qr-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", email, role }),
    });
    const json = await res.json();
    setQrLoading(false);
    if (!res.ok) {
      setError(json.error || "Could not start the QR sign-up.");
      return;
    }
    setQrSecret(json.secret);
    setQrData(json.qr_data);
    setQrStarted(true);
  }

  /** Verify the 6-digit code from the authenticator app and create the account. */
  async function handleQrComplete() {
    if (qrCode.length !== 6) return;
    setQrLoading(true);
    setError(null);
    const res = await fetch("/api/internal/auth/qr-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", email, code: qrCode }),
    });
    const json = await res.json();
    setQrLoading(false);
    if (!res.ok) {
      setError(json.error || "Could not create the account.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.setSession({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
    });
    router.push("/onboarding");
    router.refresh();
  }

  async function handleOtpVerify() {
    if (!otpCode.trim()) {
      setError("Enter the code from your email.");
      return;
    }
    setOtpLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode.trim(),
      type: "email",
    });
    setOtpLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Optional 2FA setup step for brand-new accounts; it skips straight to
    // onboarding if the user declines or already has a verified factor.
    router.push("/setup-mfa?next=/onboarding");
    router.refresh();
  }

  if (confirmationSent) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <Check className="h-6 w-6 text-success" />
            </div>
            <h2 className="font-heading text-xl font-semibold">Check your email</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a confirmation link to <strong>{email}</strong>.
              Click the link to verify your account and continue setup.
            </p>
            <Link
              href="/login"
              className="mt-6 text-sm font-medium text-primary hover:underline"
            >
              Already confirmed? Log in
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center">Create your account</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>I am joining as a...</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("creator")}
                className={cn(
                  "flex flex-col items-center rounded-lg border-2 p-4 transition-colors",
                  role === "creator"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <span className="font-heading font-semibold">Creator</span>
                <span className="text-xs text-muted-foreground">Earn from campaigns</span>
              </button>
              <button
                type="button"
                onClick={() => setRole("business")}
                className={cn(
                  "flex flex-col items-center rounded-lg border-2 p-4 transition-colors",
                  role === "business"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <span className="font-heading font-semibold">Business</span>
                <span className="text-xs text-muted-foreground">Find creators</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToMSA}
                onChange={(e) => setAgreedToMSA(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-xs text-muted-foreground">
                I agree to the Master Service Agreement: Adswish provides escrow and tracking tools. We are not a party to your campaign agreement. We mediate disputes per our SLA policy but do not guarantee campaign outcomes. Adswish charges a 10% platform fee on all transactions. This fee is non-refundable. By proceeding, you agree to our{" "}
                <Link href="/legal/terms" className="text-primary hover:underline">Terms of Service</Link>.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToPrivacy}
                onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-xs text-muted-foreground">
                I have read the{" "}
                <Link href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</Link>{" "}
                and consent to the processing of my personal data as described therein.
              </span>
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating account...
              </>
            ) : (
              "Create account"
            )}
          </Button>
        </form>
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon className="h-4 w-4" />
          )}
          Continue with Google
        </Button>
        <div className="relative mt-3 overflow-hidden rounded-md border border-border">
          {/* Coming soon: not clickable until the Azure provider is configured. */}
          <div className="pointer-events-none select-none blur-[3px]" aria-hidden="true">
            <div className="flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground">
              <MicrosoftIcon className="h-4 w-4" />
              Continue with Microsoft
            </div>
          </div>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Coming soon
          </span>
        </div>
        {otpSent ? (
          <div className="mt-3 space-y-2">
            <Label htmlFor="otp">One-time code</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code from your email"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
            />
          </div>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full"
          onClick={otpSent ? handleOtpVerify : handleOtpRequest}
          disabled={otpLoading}
        >
          {otpLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="h-4 w-4" />
          )}
          {otpSent ? "Verify one-time code" : "Create account with a one-time code"}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          No password needed — we&apos;ll email you a code to sign in.
        </p>
        <div className="relative mt-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-3 text-xs text-muted-foreground">or</span>
          </div>
        </div>
        {!qrStarted ? (
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={handleQrStart}
            disabled={qrLoading}
          >
            {qrLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
            Email not arriving? Sign up with your authenticator app
          </Button>
        ) : (
          <div className="mt-4 space-y-3 rounded-md border border-border bg-muted/30 p-4">
            <p className="text-center text-xs text-muted-foreground">
              Scan this QR code with Google Authenticator, Microsoft Authenticator,
              Authy, or 1Password, then enter the 6-digit code to create your account
              — no email needed.
            </p>
            {qrData && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrData}
                alt="QR code for your authenticator app"
                className="mx-auto h-40 w-40"
              />
            )}
            {qrSecret && (
              <p className="text-center text-xs text-muted-foreground">
                Or enter manually:{" "}
                <code className="rounded bg-muted px-1">{qrSecret}</code>
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="qr-code">6-digit code</Label>
              <Input
                id="qr-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="button"
              className="w-full"
              onClick={handleQrComplete}
              disabled={qrLoading || qrCode.length !== 6}
            >
              {qrLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Create account &amp; sign in
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => {
                setQrStarted(false);
                setQrCode("");
                setError(null);
              }}
            >
              Back
            </Button>
          </div>
        )}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <SignupComponent />
    </Suspense>
  );
}
