"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PlatformSelector } from "@/components/verification/platform-selector";
import { TokenDisplay } from "@/components/verification/token-display";
import { LockBanner } from "@/components/verification/lock-banner";
import { ScoreDisplay } from "@/components/verification/score-display";
import type { SocialPlatform } from "@/lib/verification-token";
import { computeCampaignStatus } from "@/lib/campaign-verification";

type Step = "select" | "tokens" | "verify" | "audit" | "score";

interface Campaign {
  id: string;
  status: string;
  selected_platforms: SocialPlatform[];
  domain: string | null;
  business_name: string;
}

interface TokenData {
  platform: SocialPlatform;
  handle: string;
  display_code: string;
  expires_at: string;
  status: "pending" | "verifying" | "verified" | "failed" | "expired";
  follower_count: number;
  follower_threshold: number;
}

interface AuditResult {
  overall_score: number;
  status: string;
  platform_results: Record<string, any>;
  cross_platform_verified: boolean;
  identity_confidence: number;
}

const TABS: { id: Step; label: string }[] = [
  { id: "select", label: "1. Select Platforms" },
  { id: "tokens", label: "2. Tokens" },
  { id: "verify", label: "3. Verify" },
  { id: "audit", label: "4. Audit" },
  { id: "score", label: "5. Authenticity" },
];

export default function VerificationPage() {
  const supabase = createSupabaseBrowserClient();
  const [step, setStep] = useState<Step>("select");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([]);
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [handles, setHandles] = useState<Record<SocialPlatform, string>>({
    youtube: "",
    tiktok: "",
    instagram: "",
    twitter: "",
  });
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing campaign
  useEffect(() => {
    loadCampaign();
  }, []);

  async function loadCampaign() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Get business profile
    const { data: business } = await supabase
      .from("business_profiles")
      .select("id")
      .eq("user_id", session.user.id)
      .single();

    if (!business) return;

    // Get latest campaign
    const { data: campaigns } = await supabase
      .from("verification_campaigns")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (campaigns && campaigns.length > 0) {
      const c = campaigns[0];
      setCampaign(c);
      setSelectedPlatforms(c.selected_platforms || []);

      // Load tokens
      const { data: pvs } = await supabase
        .from("platform_verifications")
        .select("*")
        .eq("campaign_id", c.id);

      if (pvs) {
        setTokens(pvs.map((pv: any) => ({
          platform: pv.platform,
          handle: pv.handle,
          display_code: `VERIFY-${c.business_id.slice(0, 6).toUpperCase()}-C-${pv.platform === "youtube" ? "YO" : pv.platform === "tiktok" ? "TT" : pv.platform === "instagram" ? "IG" : "TW"}-${pv.token_signature?.slice(0, 8) || "pending"}`,
          expires_at: pv.token_expires_at,
          status: pv.status,
          follower_count: pv.follower_count,
          follower_threshold: pv.follower_threshold,
        })));
      }

      // Set step based on status
      if (c.status === "verified") setStep("score");
      else if (c.status === "under_review") setStep("audit");
      else if (c.status === "locked" || c.status === "pending_verification") setStep("verify");
    }
  }

  async function createCampaign() {
    if (selectedPlatforms.length === 0) {
      setError("Select at least one platform");
      return;
    }

    setLoading(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { data: business } = await supabase
      .from("business_profiles")
      .select("id, business_name")
      .eq("user_id", session.user.id)
      .single();

    if (!business) {
      setError("Business profile not found");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/internal/verification/campaigns", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        business_id: business.id,
        business_name: business.business_name || "",
        selected_platforms: selectedPlatforms,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    setCampaign({
      id: data.campaign_id,
      status: "draft",
      selected_platforms: selectedPlatforms,
      domain: null,
      business_name: business.business_name || "",
    });

    setStep("tokens");
    setLoading(false);
  }

  async function generateTokens() {
    if (!campaign) return;
    setLoading(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const newTokens: TokenData[] = [];

    for (const platform of selectedPlatforms) {
      const handle = handles[platform] || "";
      if (!handle) continue;

      const res = await fetch("/api/internal/verification/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campaign_id: campaign.id,
          platform,
          handle,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        newTokens.push({
          platform,
          handle,
          display_code: data.display_code,
          expires_at: data.expires_at,
          status: "pending",
          follower_count: 0,
          follower_threshold: platform === "youtube" ? 1000 : platform === "tiktok" ? 5000 : platform === "instagram" ? 3000 : 2500,
        });
      }
    }

    setTokens(newTokens);
    setStep("verify");
    setLoading(false);
  }

  async function runAudit() {
    if (!campaign) return;
    setLoading(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/internal/verification/audit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ campaign_id: campaign.id }),
    });

    const data = await res.json();
    if (res.ok) {
      setAuditResult(data);
      setStep("score");
    } else {
      setError(data.error);
    }
    setLoading(false);
  }

  // Compute lock state
  const platformRows = tokens.map((t) => ({
    platform: t.platform,
    status: t.status,
    follower_count: t.follower_count,
    threshold_met: t.follower_count >= t.follower_threshold,
    token_posted: t.status === "verified",
  }));

  const computedStatus = computeCampaignStatus(
    (campaign?.status || "draft") as any,
    selectedPlatforms,
    platformRows as any,
  );

  const locked = computedStatus === "locked";
  const unverified = selectedPlatforms.filter((pf) => {
    const row = tokens.find((t) => t.platform === pf);
    return !row || row.status !== "verified";
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">SocialVerify Campaign</h1>
        <p className="text-sm text-muted-foreground">
          Independent verification — no API keys, no proprietary apps
        </p>
      </div>

      {/* Lock banner */}
      <LockBanner
        locked={locked}
        unverified={unverified}
        selectedCount={selectedPlatforms.length}
        verifiedCount={selectedPlatforms.length - unverified.length}
      />

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStep(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm transition-all ${
              step === tab.id
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Step 1: Select Platforms */}
      {step === "select" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium">Select platforms to verify</h2>
            <PlatformSelector
              selected={selectedPlatforms}
              onChange={setSelectedPlatforms}
              disabled={!!campaign && campaign.status !== "draft"}
            />

            {selectedPlatforms.length > 0 && (
              <div className="mt-4 space-y-3">
                <h3 className="text-sm font-medium">Enter your handles</h3>
                {selectedPlatforms.map((pf) => (
                  <div key={pf} className="flex items-center gap-3">
                    <label className="w-24 text-sm text-muted-foreground capitalize">{pf}</label>
                    <input
                      type="text"
                      placeholder={`@your${pf}handle`}
                      value={handles[pf]}
                      onChange={(e) => setHandles({ ...handles, [pf]: e.target.value })}
                      className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={campaign ? loadCampaign : createCampaign}
              disabled={loading || selectedPlatforms.length === 0}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Loading..." : campaign ? "Continue to Tokens" : "Generate Verification Tokens"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Tokens */}
      {step === "tokens" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-2 text-lg font-medium">🔐 Cryptographic Verification Tokens</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Post these tokens to your bio/description. They expire in 7 days. Only you can generate them.
            </p>
            <TokenDisplay tokens={tokens} />
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-2 text-lg font-medium">📋 Posting Instructions</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              {selectedPlatforms.includes("youtube") && (
                <div>
                  <strong className="text-foreground">YouTube:</strong> Studio → Customization → Basic Info → Description. Add your verification token.
                </div>
              )}
              {selectedPlatforms.includes("tiktok") && (
                <div>
                  <strong className="text-foreground">TikTok:</strong> Profile → Edit Profile → Bio. Add your verification token + website link.
                </div>
              )}
              {selectedPlatforms.includes("instagram") && (
                <div>
                  <strong className="text-foreground">Instagram:</strong> Profile → Edit Profile → Bio. Add your verification token + website link.
                </div>
              )}
              {selectedPlatforms.includes("twitter") && (
                <div>
                  <strong className="text-foreground">Twitter / X:</strong> Profile → Edit Profile → Bio. Pin a tweet with your token.
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setStep("verify")}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Continue to Verification
          </button>
        </div>
      )}

      {/* Step 3: Verify */}
      {step === "verify" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium">Platform Verification Status</h2>
            <TokenDisplay tokens={tokens} />
          </div>
        </div>
      )}

      {/* Step 4: Audit */}
      {step === "audit" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium">🔍 Run Full Audit</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              This will verify all tokens, check follower thresholds, and compute authenticity scores.
            </p>
            <button
              onClick={runAudit}
              disabled={loading}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Running audit..." : "Run Full Audit"}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Score */}
      {step === "score" && auditResult && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium">📊 Authenticity Score</h2>
            <ScoreDisplay
              score={{
                score: auditResult.overall_score,
                status: auditResult.status as any,
                status_label: auditResult.status === "verified" ? "Verified" : auditResult.status === "pending_review" ? "Pending Review" : "Failed",
                breakdown: {
                  engagement_rate: { value: 0, score: 0, max: 40 },
                  comment_quality: { value: 0, score: 0, max: 30 },
                  consistency: { value: 0, score: 0, max: 15 },
                  growth_velocity: { value: 0, score: 0, max: 15 },
                  cross_platform: { value: auditResult.cross_platform_verified, score: auditResult.cross_platform_verified ? 10 : 0, max: 10 },
                },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
