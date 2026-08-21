"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, LogOut, Mail } from "lucide-react";
import { resetAppearance } from "@/lib/appearance";

function SessionExpiredContent() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setEmail(user?.email ?? null);
    })();
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    resetAppearance();
    router.push("/login");
    router.refresh();
  }

  /** Redact email: show first 2 chars + domain. */
  function redactEmail(e: string) {
    const [local, domain] = e.split("@");
    return `${local.slice(0, 2)}${"*".repeat(Math.max(0, local.length - 2))}@${domain}`;
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
            <AlertTriangle className="h-6 w-6 text-warning" />
          </div>
          <h2 className="font-heading text-xl font-semibold">
            Session ended
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Another session is active on your account. Only one session is
            allowed at a time. If you didn&apos;t do this, contact support.
          </p>

          <div className="mt-6 flex w-full flex-col gap-3">
            {email && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowEmail(!showEmail)}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {showEmail ? "Hide email" : "Contact support"}
                </Button>
                {showEmail && (
                  <span className="flex-1 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium">
                    {redactEmail(email)}
                  </span>
                )}
              </div>
            )}
            <Button
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full"
            >
              {signingOut ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Sign out
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SessionExpiredPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        }
      >
        <SessionExpiredContent />
      </Suspense>
    </div>
  );
}
