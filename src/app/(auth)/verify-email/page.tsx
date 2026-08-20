"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

function VerifyEmailComponent() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  // Seed an error passed from the auth callback (e.g. an expired/used link).
  const [error, setError] = useState<string | null>(() => searchParams.get("error"));

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not resend the verification email.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-heading text-xl font-semibold">Verify your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to your email address.
            Click the link to verify your account and continue setup.
          </p>

          {error && !sent && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-left text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error} — request a new link below.</span>
            </div>
          )}

          <form onSubmit={resend} className="mt-6 w-full space-y-3 text-left">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {sent && (
              <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>Verification email sent — check your inbox (and spam folder).</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={sending || !email}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending...
                </>
              ) : (
                "Resend verification email"
              )}
            </Button>
          </form>

          <p className="mt-4 text-xs text-muted-foreground">
            Didn&apos;t receive it? Check your spam folder, or{" "}
            <Link href="/login" className="text-primary hover:underline">
              try logging in
            </Link>{" "}
            if you already verified.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <VerifyEmailComponent />
    </Suspense>
  );
}
