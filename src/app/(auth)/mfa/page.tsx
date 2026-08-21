"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import { establishSessionClient } from "@/lib/auth-session";
import type { AuthError } from "@supabase/supabase-js";

type Factor = { id: string; status: string; factor_type: string };

function MfaComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [checking, setChecking] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Figure out what's needed once. If the session is already AAL2 (2FA already
  // satisfied), or the account has no verified factor, send the user on their
  // way — this page is only a gate, never a dead end.
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
        router.replace(`/login?redirect=${encodeURIComponent(next)}`);
        return;
      }
      const verified = (user.factors as Factor[] | undefined)?.filter(
        (f) => f.status === "verified" && f.factor_type === "totp",
      );
      if (!verified || verified.length === 0) {
        router.replace(next);
        return;
      }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        router.replace(next);
        return;
      }
      setFactorId(verified[0].id);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setError((challengeError as AuthError).message);
      setLoading(false);
      return;
    }

    const { data: verify, error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setError((verifyError as AuthError).message);
      setLoading(false);
      return;
    }

    // Upgrade the persisted session to AAL2 with the fresh tokens.
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: verify.access_token,
      refresh_token: verify.refresh_token,
    });
    if (sessionError) {
      setError((sessionError as AuthError).message);
      setLoading(false);
      return;
    }

    await establishSessionClient(supabase);
    router.push(next);
    router.refresh();
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-center">Two-factor authentication</CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app
            (Google Authenticator, Microsoft Authenticator, Authy…).
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Authenticator code</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                "Verify & continue"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Codes refresh every 30 seconds. Having trouble?{" "}
              <a
                href={`/login?redirect=${encodeURIComponent(next)}`}
                className="font-medium text-primary hover:underline"
              >
                Log in again
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MfaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <MfaComponent />
    </Suspense>
  );
}
