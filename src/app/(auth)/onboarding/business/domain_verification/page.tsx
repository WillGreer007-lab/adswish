"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, AlertCircle } from "lucide-react";

export default function DomainVerificationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [domain, setDomain] = useState("");
  const [verificationMethod, setVerificationMethod] = useState<"dns" | "meta">("dns");
  const [dnsTxtRecord, setDnsTxtRecord] = useState("");
  const [metaTag, setMetaTag] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    async function loadData() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?redirect=/onboarding");
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("business_profiles")
        .select("verified_domain")
        .eq("user_id", user.id)
        .single();

      if (profile?.verified_domain) {
        setDomain(profile.verified_domain);
        setVerified(true);
      }

      const verificationCode = `adswish-verify-${user.id.slice(0, 16)}`;
      setDnsTxtRecord(`adswish-verify=${verificationCode}`);
      setMetaTag(`<meta name="adswish-verification" content="${verificationCode}" />`);
    }
    loadData();
  }, [router]);

  async function handleVerify() {
    if (!userId || !domain) return;
    setLoading(true);

    const response = await fetch("/api/internal/verify-domain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, method: verificationMethod }),
    });
    const data = await response.json();

    if (data.verified) {
      const supabase = createSupabaseBrowserClient();
      await supabase
        .from("business_profiles")
        .update({
          verified_domain: domain,
          onboarding_step: "plan_selection",
        })
        .eq("user_id", userId);
      setVerified(true);
      setTimeout(() => router.push("/onboarding/business/plan_selection"), 1500);
    } else {
      alert(data.message || "Verification failed. Please check your DNS or meta tag and try again.");
    }
    setLoading(false);
  }

  async function handleSkip() {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from("business_profiles")
      .update({ onboarding_step: "plan_selection" })
      .eq("user_id", userId);
    router.push("/onboarding/business/plan_selection");
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Verify your domain</CardTitle>
        <p className="text-sm text-muted-foreground">
          Step 2 of 4 — Prove brand ownership. Required for affiliate tracking.
        </p>
      </CardHeader>
      <CardContent>
        {verified ? (
          <div className="flex flex-col items-center text-center">
            <Check className="mb-4 h-12 w-12 text-success" />
            <p className="font-heading text-lg font-semibold">Domain verified!</p>
            <p className="mt-1 text-sm text-muted-foreground">{domain}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Your website domain</Label>
              <Input
                id="domain"
                placeholder="example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Verification method</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVerificationMethod("dns")}
                  className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                    verificationMethod === "dns"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  DNS TXT Record
                </button>
                <button
                  type="button"
                  onClick={() => setVerificationMethod("meta")}
                  className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                    verificationMethod === "meta"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  Meta Tag
                </button>
              </div>
            </div>

            {verificationMethod === "dns" ? (
              <div className="space-y-2">
                <Label>Add this TXT record to your DNS</Label>
                <div className="rounded-md border border-border bg-muted p-3">
                  <code className="break-all font-mono text-xs">{dnsTxtRecord}</code>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add the TXT record, wait a few minutes for DNS propagation, then click verify.
                  3 automatic retry attempts over 24 hours. After failures, manual admin review.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Add this tag to your homepage&apos;s &lt;head&gt;</Label>
                <div className="rounded-md border border-border bg-muted p-3">
                  <code className="break-all font-mono text-xs">{metaTag}</code>
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste the meta tag into your homepage HTML, then click verify.
                </p>
              </div>
            )}

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Domain verification is required for Affiliate/Hybrid campaigns.
                  Fixed-fee campaigns can launch without it. You can skip and verify later.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleSkip}>
                Skip for now
              </Button>
              <Button onClick={handleVerify} className="flex-1" disabled={loading || !domain}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</> : "Verify domain"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
