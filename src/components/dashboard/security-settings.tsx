"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, ShieldOff, Smartphone, CheckCircle2, AlertCircle } from "lucide-react";
import type { AuthError } from "@supabase/supabase-js";

type Factor = { id: string; status: string; friendly_name?: string | null };

export function SecuritySettings() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [verifiedFactor, setVerifiedFactor] = useState<Factor | null>(null);

  // Enrollment flow
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refreshFactors() {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    if (!u) {
      router.push("/login?redirect=/dashboard/settings/security");
      return;
    }
    const verified = (u.factors as Factor[] | undefined)?.filter((f) => f.status === "verified") ?? [];
    setVerifiedFactor(verified[0] ?? null);
    setChecking(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Defer so the first (server-matching) render stays identical and the
      // factor lookup is applied in a follow-up microtask.
      await Promise.resolve();
      if (cancelled) return;
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u) {
        router.push("/login?redirect=/dashboard/settings/security");
        return;
      }
      const verified =
        (u.factors as Factor[] | undefined)?.filter((f) => f.status === "verified") ?? [];
      setVerifiedFactor(verified[0] ?? null);
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
      // A partially-created factor can exist from a previous attempt — re-check.
      await refreshFactors();
      return;
    }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
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
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: verifyCode,
    });
    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    setSuccess("Two-factor authentication is now enabled.");
    setQrCode(null);
    setSecret(null);
    setFactorId(null);
    setVerifyCode("");
    setLoading(false);
    await refreshFactors();
  }

  async function handleDisable() {
    if (!verifiedFactor) return;
    if (
      !window.confirm(
        "Disable two-factor authentication? Your account will only be protected by your password.",
      )
    ) {
      return;
    }
    setRemoving(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: verifiedFactor.id,
    });
    if (unenrollError) {
      setError((unenrollError as AuthError).message);
      setRemoving(false);
      return;
    }

    setVerifiedFactor(null);
    setRemoving(false);
    setSuccess("Two-factor authentication has been disabled.");
    await refreshFactors();
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {success && (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {verifiedFactor ? (
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-success/10">
              <ShieldCheck className="h-6 w-6 text-success" />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold">Two-factor authentication</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enabled — a 6-digit code from your authenticator app is required
                when you log in.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={handleDisable}
            disabled={removing}
          >
            {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
            Disable
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
              <Smartphone className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold">Two-factor authentication</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Not enabled. Add an extra layer of security using Google
                Authenticator, Microsoft Authenticator, Authy, 1Password, or any
                TOTP app.
              </p>
            </div>
          </div>

          {!qrCode ? (
            <Button className="mt-5" onClick={startEnrollment} disabled={enrolling}>
              {enrolling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Setting up...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" /> Set up 2FA
                </>
              )}
            </Button>
          ) : (
            <form onSubmit={handleVerify} className="mt-6 space-y-4">
              <div className="flex flex-col items-center rounded-lg border border-border bg-muted/30 p-5">
                <img
                  src={qrCode}
                  alt="Scan this QR code with your authenticator app"
                  className="h-48 w-48 rounded-lg border border-border bg-white"
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  Scan with Google Authenticator, Microsoft Authenticator, Authy, or 1Password
                </p>
                {secret && (
                  <p className="mt-2 rounded-md bg-background px-3 py-1.5 font-mono text-xs text-muted-foreground">
                    Secret: {secret}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Enter 6-digit code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={loading || verifyCode.length !== 6}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                    </>
                  ) : (
                    "Verify & enable"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setQrCode(null);
                    setSecret(null);
                    setFactorId(null);
                    setVerifyCode("");
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
