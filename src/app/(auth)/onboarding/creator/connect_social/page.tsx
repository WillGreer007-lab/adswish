"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, Check, ChevronLeft, Copy, ArrowRight } from "lucide-react";

type Platform = "tiktok" | "instagram" | "youtube" | "twitter";
type Tier = "micro" | "mid" | "macro";

const MIN_FOLLOWERS = 10000;

const PLATFORMS: { id: Platform; label: string; icon: string; bioHint: string }[] = [
  { id: "tiktok", label: "TikTok", icon: "🎵", bioHint: "Profile → Edit profile → Bio" },
  { id: "instagram", label: "Instagram", icon: "📸", bioHint: "Profile → Edit profile → Bio" },
  { id: "youtube", label: "YouTube", icon: "🎬", bioHint: "Studio → Customization → Basic info → Description" },
  { id: "twitter", label: "Twitter / X", icon: "𝕏", bioHint: "Profile → Edit profile → Bio" },
];

function getTier(followerCount: number): Tier | null {
  if (followerCount < 10000) return null;
  if (followerCount < 100000) return "micro";
  if (followerCount < 1000000) return "mid";
  return "macro";
}

const TIER_LABELS: Record<Tier, { label: string; color: string }> = {
  micro: { label: "Small Creator (10K–99.9K)", color: "text-emerald-600" },
  mid: { label: "Moderate Creator (100K–999.9K)", color: "text-blue-600" },
  macro: { label: "Big Creator (1M+)", color: "text-violet-600" },
};

const STEPS = ["Platform", "Details", "Verify", "Review"];

export default function ConnectSocialPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);

  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("instagram");
  const [handle, setHandle] = useState("");
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tier = followerCount !== null ? getTier(followerCount) : null;
  const platformInfo = PLATFORMS.find((p) => p.id === selectedPlatform)!;

  useEffect(() => {
    async function loadData() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?redirect=/onboarding");
        return;
      }
      setUserId(user.id);

      const { data: accounts } = await supabase
        .from("creator_social_accounts")
        .select("*")
        .eq("creator_id", user.id);
      setConnectedAccounts(accounts || []);

      try {
        const tokenRes = await fetch("/api/internal/manual-verifications");
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          setTokens(tokenData.tokens ?? {});
        }
      } catch {
        // tokens are optional — the form still works without them
      }

      if (accounts && accounts.length > 0) {
        const first = accounts[0];
        setSelectedPlatform(first.platform);
        setHandle(first.handle);
        setFollowerCount(first.follower_count);
      }
      setLoading(false);
    }
    loadData();
  }, [router]);

  function handleFollowerInput(value: string) {
    const count = parseInt(value, 10);
    setFollowerCount(isNaN(count) ? null : count);
  }

  async function copyProofCode() {
    const code = tokens[selectedPlatform];
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  const canLeavePlatform = Boolean(selectedPlatform);
  const canLeaveDetails = handle.trim().length > 0 && followerCount !== null;
  const canLeaveVerify = Boolean(screenshot);

  async function submitVerification() {
    if (!userId) return;
    setError(null);

    if (followerCount === null || followerCount < MIN_FOLLOWERS) {
      setError(`You need at least ${MIN_FOLLOWERS.toLocaleString()} followers on at least one platform to join Adswish.`);
      setStep(1);
      return;
    }
    if (!screenshot) {
      setError("Upload a screenshot for manual verification before continuing.");
      setStep(2);
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();

    const form = new FormData();
    form.append("platform", selectedPlatform);
    form.append("handle", handle);
    form.append("follower_count", String(followerCount));
    form.append("file", screenshot);
    const verificationResponse = await fetch("/api/internal/manual-verifications", {
      method: "POST",
      body: form,
    });
    const verificationData = await verificationResponse.json().catch(() => ({}));
    if (!verificationResponse.ok) {
      setError(verificationData.error || "Could not submit the screenshot for review.");
      setSubmitting(false);
      return;
    }

    if (tier) {
      await supabase
        .from("creator_profiles")
        .update({
          onboarding_step: "plan_selection",
          tier,
          previous_tier: tier,
          tier_changed_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }

    router.push("/onboarding/creator/plan_selection");
  }

  async function handleSkip() {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from("creator_profiles")
      .update({ onboarding_step: "plan_selection" })
      .eq("user_id", userId);
    router.push("/onboarding/creator/plan_selection");
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Connect a social account</CardTitle>
        <p className="text-sm text-muted-foreground">
          Step 2 of 4 — You need at least 10,000 followers on one platform to join.
        </p>
      </CardHeader>
      <CardContent>
        {/* Progress indicator */}
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={
                  i <= step
                    ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                    : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium text-muted-foreground"
                }
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={
                  i <= step ? "hidden text-xs font-medium sm:block" : "hidden text-xs text-muted-foreground sm:block"
                }
              >
                {label}
              </span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        {connectedAccounts.length > 0 && step === 0 && (
          <div className="mb-4 rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Already connected
            </p>
            {connectedAccounts.map((acc) => (
              <div key={acc.id} className="mt-2 flex flex-wrap items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span className="text-sm capitalize">{acc.platform}</span>
                <span className="text-sm text-muted-foreground">@{acc.handle}</span>
                <span className="font-mono text-sm font-semibold">
                  {acc.follower_count.toLocaleString()}
                </span>
                {getTier(acc.follower_count) && (
                  <span className={`text-xs font-medium ${TIER_LABELS[getTier(acc.follower_count)!].color}`}>
                    {TIER_LABELS[getTier(acc.follower_count)!].label}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* STEP 0: Platform */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Choose the platform you want to verify</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                You can add more platforms from your dashboard later. Each platform must meet the
                10,000-follower minimum and is verified manually by our team.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PLATFORMS.map((p) => {
                const isSelected = selectedPlatform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlatform(p.id)}
                    className={
                      isSelected
                        ? "flex items-center gap-3 rounded-lg border-2 border-primary bg-primary/5 p-4 text-left"
                        : "flex items-center gap-3 rounded-lg border border-border p-4 text-left hover:bg-muted/50"
                    }
                  >
                    <span className="text-2xl" aria-hidden>{p.icon}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{p.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        min 10,000 followers
                      </span>
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(1)} disabled={!canLeavePlatform}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 1: Details */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">
                {platformInfo.icon} Your {platformInfo.label} account
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter the handle and follower count exactly as shown on your public profile.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="handle">{platformInfo.label} handle</Label>
              <Input
                id="handle"
                placeholder="@yourusername"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="followers">Follower count</Label>
              <Input
                id="followers"
                type="number"
                placeholder="e.g. 250000"
                value={followerCount ?? ""}
                onChange={(e) => handleFollowerInput(e.target.value)}
              />
              {tier && (
                <p className={`text-sm font-medium ${TIER_LABELS[tier].color}`}>
                  Assigned tier: {TIER_LABELS[tier].label}
                </p>
              )}
              {followerCount !== null && followerCount < MIN_FOLLOWERS && (
                <p className="text-sm text-destructive">
                  You need at least 10,000 followers to join Adswish.
                </p>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(2)} disabled={!canLeaveDetails}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Verify ownership */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Prove you own this account</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Paste the code below into your {platformInfo.label} bio, then upload a screenshot
                showing it. Our team confirms the code matches before your count is accepted.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Your {platformInfo.label} verification code</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-md border border-primary/30 bg-primary/5 px-3 py-2 font-mono text-base font-bold tracking-wider">
                  {tokens[selectedPlatform] ?? "Loading…"}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyProofCode}
                  disabled={!tokens[selectedPlatform]}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Open {platformInfo.bioHint}.</li>
              <li>Paste the code above into your bio or description.</li>
              <li>Take a screenshot of your public profile showing both the code and your follower count.</li>
            </ol>

            <div className="space-y-2">
              <Label htmlFor="screenshot">Verification screenshot</Label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 hover:border-primary">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {screenshot ? screenshot.name : "Choose screenshot (PNG, JPEG, or WebP; max 10MB)"}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Your follower count is <strong>never auto-verified</strong> — an admin reviews this
                screenshot to confirm you own the account.
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canLeaveVerify}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Review and submit</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Confirm the details below. You can fix anything by going back.
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Platform</span>
                <span className="font-medium">{platformInfo.icon} {platformInfo.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Handle</span>
                <span className="font-medium">@{handle}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Followers</span>
                <span className="font-mono font-medium">{(followerCount ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tier</span>
                <span className={tier ? `font-medium ${TIER_LABELS[tier].color}` : "font-medium"}>
                  {tier ? TIER_LABELS[tier].label : "Below minimum"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Screenshot</span>
                <span className="font-medium">{screenshot ? screenshot.name : "None"}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={handleSkip} disabled={submitting}>
                  Skip for now
                </Button>
                <Button onClick={submitVerification} disabled={submitting}>
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                  ) : (
                    <>Submit for review <ArrowRight className="h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
