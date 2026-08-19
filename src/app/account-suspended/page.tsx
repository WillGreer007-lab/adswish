"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

export default function AccountSuspendedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    await createSupabaseBrowserClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/10">
          <AlertTriangle className="h-7 w-7 text-warning" />
        </div>
        <h1 className="mt-5 font-heading text-2xl font-bold">Account access paused</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          An administrator has paused access to this Adswish account. Please contact support if you believe this was a mistake.
        </p>
        <Button className="mt-6 w-full" onClick={signOut} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Sign out
        </Button>
      </section>
    </main>
  );
}
