"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";

export default function MfaSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function startEnrollment() {
    setEnrolling(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      issuer: "Adswish",
      friendlyName: "Admin Authenticator",
    });

    if (error) {
      setError(error.message);
      setEnrolling(false);
      return;
    }

    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
    setEnrolling(false);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError) {
      setError(challengeError.message);
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: verifyCode,
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-foreground px-4">
      <Card className="w-full max-w-md bg-surface text-foreground">
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
            <ShieldCheck className="h-6 w-6 text-warning" />
          </div>
          <CardTitle>MFA Required</CardTitle>
          <p className="text-sm text-muted-foreground">
            Admin accounts must enable TOTP MFA before accessing any admin route.
          </p>
        </CardHeader>
        <CardContent>
          {!qrCode ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                  <p className="text-xs text-muted-foreground">
                    You cannot access admin routes without MFA. This is enforced at the middleware layer.
                  </p>
                </div>
              </div>
              <Button onClick={startEnrollment} className="w-full" disabled={enrolling}>
                {enrolling ? <><Loader2 className="h-4 w-4 animate-spin" /> Setting up...</> : "Set up TOTP MFA"}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="flex flex-col items-center">
                <img src={qrCode} alt="MFA QR Code" className="h-48 w-48 rounded-lg border border-border" />
                <p className="mt-2 text-xs text-muted-foreground">Scan with Google Authenticator, Authy, or 1Password</p>
                {secret && (
                  <p className="mt-2 font-mono text-xs text-muted-foreground">Secret: {secret}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Enter 6-digit code</Label>
                <Input
                  id="code"
                  placeholder="123456"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading || verifyCode.length !== 6}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</> : "Verify & continue"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
