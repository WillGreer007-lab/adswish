"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { createClient, type AuthError } from "@supabase/supabase-js";
import { GoogleIcon } from "@/components/ui/google-icon";
import { MicrosoftIcon } from "@/components/ui/oauth-icons";

function LoginComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Seed any OAuth/auth error passed via ?error= so a failed provider callback
  // (e.g. bad_oauth_state) is visible instead of silently swallowed.
  const [error, setError] = useState<string | null>(() => searchParams.get("error"));
  // Session timed out (inactivity or back-button auto-logout) → show a banner.
  const timedOut = searchParams.get("timeout") === "1";
  // Email verified server-side after a cross-browser confirmation link.
  const confirmed = searchParams.get("confirmed") === "1";

  // One-time code (authenticator) sign-in — no password needed.
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  // TOTP second-factor step (authenticator apps like Google/Microsoft Authenticator).
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  // Authenticator login fallback — email + 6-digit code, no email code needed.
  const [authOpen, setAuthOpen] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Forgot-password reset link.
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const emailNotConfirmed =
    error !== null && /not confirmed|confirm your email/i.test(error);

  /**
   * Session-free client for the credential step: no session is persisted until
   * 2FA (if any) has been satisfied, so an AAL1 session can never leak into the
   * browser while a user backs out of the authenticator step.
   */
  function probeClient() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const probe = probeClient();
    const { data, error } = await probe.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.code === "mfa_verification_required") {
        const factors = (error as AuthError & { factors?: { id: string; factor_type: string }[] })
          .factors ?? [];
        const totp = factors.find((f) => f.factor_type === "totp");
        setMfaFactorId(totp?.id ?? factors[0]?.id ?? null);
        setMfaRequired(true);
        setError(null);
        setLoading(false);
        return;
      }
      setError(error.message);
      setLoading(false);
      return;
    }

    // App-level 2FA enforcement: if the account has a verified authenticator
    // factor, require a code before persisting any session (works even when
    // the Supabase project's MFA enforcement mode is "Optional").
    const factors =
      (data.user?.factors as { id: string; status: string; factor_type: string }[] | undefined)
        ?.filter((f) => f.status === "verified") ?? [];
    if (factors.length > 0) {
      setMfaFactorId(factors[0].id);
      setMfaRequired(true);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setError("No session returned — confirm your email address first.");
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (sessionError) {
      setError(sessionError.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  /** Verify the 6-digit authenticator code after a password / OTP login. */
  async function handleMfaVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId || mfaCode.length !== 6) return;
    setMfaLoading(true);
    setError(null);

    const probe = probeClient();
    const { data: challenge, error: challengeError } = await probe.auth.mfa.challenge({
      factorId: mfaFactorId,
    });
    if (challengeError) {
      setError(challengeError.message);
      setMfaLoading(false);
      return;
    }

    const { data: verify, error: verifyError } = await probe.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code: mfaCode,
    });
    if (verifyError) {
      setError(verifyError.message);
      setMfaLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: verify.access_token,
      refresh_token: verify.refresh_token,
    });
    if (sessionError) {
      setError(sessionError.message);
      setMfaLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  /** Log in with the authenticator app (email + 6-digit code, no email sent). */
  async function handleAuthLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    if (authCode.length !== 6) return;
    setAuthLoading(true);
    setError(null);
    const res = await fetch("/api/internal/auth/totp-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: authCode }),
    });
    const json = await res.json();
    setAuthLoading(false);
    if (!res.ok) {
      setError(json.error || "Could not log in with the authenticator.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.setSession({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
    });
    router.push(redirectTo);
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  }

  async function handleOtpRequest() {
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

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    setResetLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password&email=${encodeURIComponent(email.trim())}`,
    });
    setResetLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResetSent(true);
  }

  async function handleOtpVerify() {
    if (!otpCode.trim()) {
      setError("Enter the code from your email.");
      return;
    }
    setOtpLoading(true);
    setError(null);
    const probe = probeClient();
    const { data, error } = await probe.auth.verifyOtp({
      email,
      token: otpCode.trim(),
      type: "email",
    });
    setOtpLoading(false);
    if (error) {
      if (error.code === "mfa_verification_required") {
        const factors = (error as AuthError & { factors?: { id: string; factor_type: string }[] })
          .factors ?? [];
        const totp = factors.find((f) => f.factor_type === "totp");
        setMfaFactorId(totp?.id ?? factors[0]?.id ?? null);
        setMfaRequired(true);
        setError(null);
        return;
      }
      setError(error.message);
      return;
    }

    // App-level 2FA enforcement — same as the password path.
    const factors =
      (data.user?.factors as { id: string; status: string; factor_type: string }[] | undefined)
        ?.filter((f) => f.status === "verified") ?? [];
    if (factors.length > 0) {
      setMfaFactorId(factors[0].id);
      setMfaRequired(true);
      return;
    }

    if (data.session) {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center">Log in to Adswish</CardTitle>
      </CardHeader>
      <CardContent>
        {timedOut && (
          <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            Session has timed out. Please sign in again to continue.
          </div>
        )}
        {confirmed && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>Your email is verified — you can log in now.</span>
          </div>
        )}
        {mfaRequired ? (
          <form onSubmit={handleMfaVerify} className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <span>
                Two-factor authentication required — enter the 6-digit code from
                your authenticator app (Google Authenticator, Microsoft Authenticator, Authy…).
              </span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mfa">Authenticator code</Label>
              <Input
                id="mfa"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex items-center gap-2">
              <Button type="submit" className="w-full" disabled={mfaLoading || mfaCode.length !== 6}>
                {mfaLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  "Verify & log in"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMfaRequired(false);
                  setMfaCode("");
                  setError(null);
                }}
              >
                Back
              </Button>
            </div>
          </form>
        ) : (
          <>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <div className="space-y-1">
              <p className="text-sm text-destructive">{error}</p>
              {emailNotConfirmed && (
                <Link href="/verify-email" className="block text-xs font-medium text-primary hover:underline">
                  Email not confirmed? Resend the confirmation link.
                </Link>
              )}
              {!emailNotConfirmed && error === "Invalid login credentials" && (
                <p className="text-xs text-muted-foreground">
                  Wrong password, or this email has no password set (Google or one-time-code
                  accounts). Use &quot;Continue with Google&quot; or a one-time code below, or reset
                  your password.
                </p>
              )}
            </div>
          )}
          {resetSent && (
            <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>Password reset link sent — check your inbox (and spam folder).</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
                </>
              ) : (
                "Log in"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-2 shrink-0 text-xs text-muted-foreground hover:text-primary"
              onClick={handleForgotPassword}
              disabled={resetLoading}
            >
              {resetLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Forgot password?"}
            </Button>
          </div>
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
        <div className="mt-3">
          <div className="relative overflow-hidden rounded-md border border-border">
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
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        {otpSent && (
          <div className="space-y-2">
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
        )}
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
          {otpSent ? "Verify one-time code" : "Continue with a one-time code"}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          No password needed — we&apos;ll email you a code to sign in or create an account.
        </p>
        <div className="relative mt-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-3 text-xs text-muted-foreground">or</span>
          </div>
        </div>
        {!authOpen ? (
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={() => {
              setAuthOpen(true);
              setError(null);
            }}
          >
            <Smartphone className="h-4 w-4" />
            Log in with your authenticator app
          </Button>
        ) : (
          <form onSubmit={handleAuthLogin} className="mt-4 space-y-3 rounded-md border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              No email code needed — enter the 6-digit code from your authenticator
              app for this account&apos;s email.
            </p>
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-code">6-digit code</Label>
              <Input
                id="auth-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={authLoading || authCode.length !== 6}>
              {authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Log in
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => {
                setAuthOpen(false);
                setAuthCode("");
                setError(null);
              }}
            >
              Back
            </Button>
          </form>
        )}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Sign up free
          </Link>
        </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <LoginComponent />
    </Suspense>
  );
}
