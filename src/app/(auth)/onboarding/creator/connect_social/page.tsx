"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { YouTubeHandleVerify } from "@/components/dashboard/youtube-handle-verify";
import { Loader2, Upload, Check, Instagram, Link2 } from "lucide-react";

type Platform = "tiktok" | "instagram" | "youtube" | "twitter";

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "twitter", label: "Twitter/X" },
];

function getTier(followerCount: number): "micro" | "mid" | "macro" | null {
  if (followerCount < 1000) return null;
  if (followerCount < 10000) return "micro";
  if (followerCount < 100000) return "mid";
  return "macro";
}

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  micro: { label: "Small Creator (1K–9.9K)", color: "text-emerald-600" },
  mid: { label: "Moderate Creator (10K–99.9K)", color: "text-blue-600" },
  macro: { label: "Big Creator (100K+)", color: "text-violet-600" },
};

function ConnectSocialPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<Platform | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("instagram");
  const [handle, setHandle] = useState("");
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [tier, setTier] = useState<"micro" | "mid" | "macro" | null>(null);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);
  const err = searchParams.get("error");
  const oauthError = err === "tiktok_not_configured"
    ? "TikTok Connect isn't set up yet — add your TikTok API keys in Settings to enable it. You can still connect manually below."
    : err === "instagram_not_configured"
      ? "Instagram Connect isn't set up yet — add your Instagram API keys in Settings to enable it. You can still connect manually below."
      : err === "token_exchange_failed"
        ? "We couldn't finish connecting that account. Please try again."
        : err
          ? `Connection failed (${err}). Please try again.`
          : null;

  function startOAuth(platform: Platform) {
    if (!userId || oauthLoading) return;
    setOauthLoading(platform);
    router.push(`/api/internal/oauth/${platform}?redirect_to=${encodeURIComponent("/onboarding/creator/connect_social")}`);
  }

  function onYouTubeVerified(account: { handle: string; follower_count: number }) {
    setConnectedAccounts((prev) => [
      ...prev.filter((a) => a.platform !== "youtube"),
      {
        id: `youtube-${Date.now()}`,
        platform: "youtube",
        handle: account.handle,
        follower_count: account.follower_count,
        verified_at: new Date().toISOString(),
      },
    ]);
    // Sync the manual form so "Continue" picks up the auto-verified count.
    setSelectedPlatform("youtube");
    setHandle(account.handle);
    setFollowerCount(account.follower_count);
    setTier(getTier(account.follower_count));
  }

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

      if (accounts && accounts.length > 0) {
        const first = accounts[0];
        setSelectedPlatform(first.platform);
        setHandle(first.handle);
        setFollowerCount(first.follower_count);
        setTier(getTier(first.follower_count));
      }
    }
    loadData();
  }, [router]);

  function handleFollowerInput(value: string) {
    const count = parseInt(value, 10);
    if (isNaN(count)) {
      setFollowerCount(null);
      setTier(null);
      return;
    }
    setFollowerCount(count);
    setTier(getTier(count));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    if (followerCount === null || followerCount < 1000) {
      alert("You need at least 1,000 followers on at least one platform to join Adswish. If your platform doesn't expose follower count, upload a screenshot for manual verification.");
      return;
    }

    const automaticallyVerified = connectedAccounts.some(
      (account) => account.platform === selectedPlatform && account.verified_at,
    );
    if (!automaticallyVerified && !screenshot) {
      alert("Upload a screenshot for manual verification before continuing.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    if (screenshot) {
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
        alert(verificationData.error || "Could not submit the screenshot for review.");
        setLoading(false);
        return;
      }
    }

    const profileUpdate: {
      onboarding_step: string;
      tier?: "micro" | "mid" | "macro";
      previous_tier?: "micro" | "mid" | "macro";
      tier_changed_at?: string;
    } = { onboarding_step: "plan_selection" };
    if (automaticallyVerified && tier) {
      profileUpdate.tier = tier;
      profileUpdate.previous_tier = tier;
      profileUpdate.tier_changed_at = new Date().toISOString();
    }

    await supabase
      .from("creator_profiles")
      .update(profileUpdate)
      .eq("user_id", userId);

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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Connect a social account</CardTitle>
        <p className="text-sm text-muted-foreground">
          Step 2 of 4 — You need at least 1,000 followers to join.
        </p>
      </CardHeader>
      <CardContent>
        {connectedAccounts.length > 0 && (
          <div className="mb-4 rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Connected accounts
            </p>
            {connectedAccounts.map((acc) => (
              <div key={acc.id} className="mt-2 flex items-center gap-2">
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

        {oauthError && (
          <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            {oauthError}
          </div>
        )}

        <div className="mb-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Connect automatically
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => startOAuth("instagram")}
              disabled={!userId || oauthLoading !== null}
            >
              {oauthLoading === "instagram" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Instagram className="h-4 w-4" />
              )}
              Connect with Instagram
            </Button>
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" />
              Verify your YouTube channel without a screenshot — we&apos;ll check your live
              subscriber count and ask you to add a one-time code to your channel About to prove
              it&apos;s yours.
            </p>
            <YouTubeHandleVerify onVerified={onYouTubeVerified} />
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or connect manually</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Platform</Label>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlatform(p.id)}
                  className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                    selectedPlatform === p.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="handle">Your {selectedPlatform} handle</Label>
            <Input
              id="handle"
              placeholder="@yourusername"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="followers">Follower count</Label>
            <Input
              id="followers"
              type="number"
              placeholder="e.g. 5000"
              value={followerCount ?? ""}
              onChange={(e) => handleFollowerInput(e.target.value)}
              required
            />
            {tier && (
              <p className={`text-sm font-medium ${TIER_LABELS[tier].color}`}>
                Assigned tier: {TIER_LABELS[tier].label}
              </p>
            )}
            {followerCount !== null && followerCount < 1000 && (
              <p className="text-sm text-destructive">
                You need at least 1,000 followers to join Adswish.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="screenshot">Verification screenshot</Label>
            <p className="text-xs text-muted-foreground">
              Required when the platform isn&apos;t connected. The follower count you type is
              <strong> never auto-verified</strong> — an admin reviews the screenshot to confirm
              you own the account before this count is accepted.
            </p>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 hover:border-primary">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {screenshot ? screenshot.name : "Choose file..."}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={handleSkip}>
              Skip for now
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Continue"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ConnectSocialPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <ConnectSocialPageInner />
    </Suspense>
  );
}
