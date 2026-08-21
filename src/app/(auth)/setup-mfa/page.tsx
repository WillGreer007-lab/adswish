"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, Smartphone, CheckCircle2, AlertCircle } from "lucide-react";
import { establishSessionClient } from "@/lib/auth-session";
import type { AuthError } from "@supabase/supabase-js";

type Factor = { id: string; status: string; factor_type: string };

function SetupMfaComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/onboarding";

  const [checking, setChecking] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // This page is the optional 2FA step for brand-new accounts. If the user
  // already has a verified authenticator factor (returning user, or they
  // completed setup in another tab), or isn't signed in, send them on their
  // way — never a dead end.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const verified = (user.factors as Factor[] | undefined)?.filter(
        (f) => f.status === "verified" && f.factor_type === "totp",
      );
      if (verified && verified.length > 0) {
        router.replace(next);
        return;
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEnrollment() {
    setEnrolling(true);
    setError(null);
    setSuccess(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      issuer: "Adswish",
      friendlyName: "Authenticator app",
    });
    setEnrolling(false);
    if (error) {
      setError(error.message);
      return;
    }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError) {
      setError(challengeError.message);
      setLoading(false);
      return;
    }
    const { data: verify, error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    // Upgrade the persisted session to AAL2 with the fresh tokens so the
    // middleware's 2FA gate passes on the very next navigation.
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: verify.access_token,
      refresh_token: verify.refresh_token,
    });
    if (sessionError) {
      setError(sessionError.message);
      setLoading(false);
      return;
    }

    setSuccess("Two-factor authentication is enabled.");
    setLoading(false);
    await establishSessionClient(supabase);
    router.push(next);
    router.refresh();
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-center">Add an extra layer of security</CardTitle>
        <p className="text-center text-sm text-muted-foreground">
          Set up two-factor authentication (optional) using any authenticator app —
          Google Authenticator, Microsoft Authenticator, Authy, or 1Password. Your
          account will need a 6-digit code from the app every time you log in.
        </p>
      </CardHeader>
      <CardContent>
        {success && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!qrCode ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <Smartphone className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <span>
                You can do this now, or skip and enable it later from
                Settings → Security &amp; 2FA.
              </span>
            </div>
            <Button className="w-full" onClick={startEnrollment} disabled={enrolling}>
              {enrolling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Preparing QR code...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" /> Set up authenticator app
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => {
                router.push(next);
                router.refresh();
              }}
            >
              Skip for now
            </Button>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-muted/40 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCode}
                alt="Scan this QR code with your authenticator app"
                className="h-44 w-44"
              />
              <p className="text-center text-xs text-muted-foreground">
                Scan with Google Authenticator, Microsoft Authenticator, Authy, or
                1Password. Codes refresh every 30 seconds.
              </p>
            </div>
            {secret && (
              <div className="space-y-1">
                <Label>Or enter this secret manually</Label>
                <code className="block break-all rounded-md border border-border bg-muted px-3 py-2 text-xs">
                  {secret}
                </code>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="setup-code">6-digit code from your app</Label>
              <Input
                id="setup-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                "Enable two-factor authentication"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => {
                router.push(next);
                router.refresh();
              }}
            >
              Skip for now
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function SetupMfaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <SetupMfaComponent />
    </Suspense>
  );
}
