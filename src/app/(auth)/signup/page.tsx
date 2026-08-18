"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check } from "lucide-react";
import { GoogleIcon } from "@/components/ui/google-icon";
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
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
