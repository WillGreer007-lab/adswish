"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PlatformSelector } from "@/components/verification/platform-selector";
import { TokenDisplay, type TokenRow } from "@/components/verification/token-display";
import { LockBanner } from "@/components/verification/lock-banner";
import { AuditLog } from "@/components/verification/audit-log";
import { ScoreDisplay, ScoreCalculator } from "@/components/verification/score-display";
import { IdentityBinding } from "@/components/verification/identity-binding";
import type { SocialPlatform } from "@/lib/socialverify/tokens";
import { PLATFORM_THRESHOLDS } from "@/lib/socialverify/tokens";

type Step = "select" | "tokens" | "identity" | "audit" | "score";

const TABS: { id: Step; label: string }[] = [
  { id: "select", label: "1. Select Platforms" },
  { id: "tokens", label: "2. Tokens" },
  { id: "identity", label: "3. Identity" },
  { id: "audit", label: "4. Audit" },
  { id: "score", label: "5. Authenticity" },
];

interface Campaign {
  id: string;
  business_id: string;
  status: string;
  selected_platforms: SocialPlatform[];
  domain: string | null;
  business_name: string;
}

export default function VerificationPage() {
  const supabase = createSupabaseBrowserClient();
  const [step, setStep] = useState<Step>("select");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<SocialPlatform[]>([]);
  const [handles, setHandles] = useState<Record<SocialPlatform, string>>({
    youtube: "",
    tiktok: "",
    instagram: "",
    twitter: "",
  });
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<{ score: number; status: string; scoreStatus: any; label: string } | null>(null);

  useEffect(() => {
    async function loadCampaign() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;
      const { data: campaigns } = await supabase
        .from("verification_campaigns")
        .select("*")
        .eq("business_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (campaigns && campaigns.length > 0) {
        const c = campaigns[0] as any;
        setCampaign(c);
        setSelected(c.selected_platforms ?? []);

        const { data: pvs } = await supabase
          .from("platform_verifications")
          .select("*")
          .eq("campaign_id", c.id);

        if (pvs) {
          setTokens(
            (pvs as any[]).map((pv) => ({
              platform: pv.platform,
              handle: pv.handle,
              display_code: pv.verification_token,
              expires_at: pv.token_expires_at,
              status: pv.status,
              follower_count: pv.follower_count,
              follower_threshold: pv.follower_threshold,
            })),
          );
        }

        if (c.status === "verified") setStep("score");
        else if (c.status === "under_review") setStep("audit");
        else if (c.status === "locked" || c.status === "pending_verification") setStep("tokens");
      }
    }
    loadCampaign();
  }, [supabase]);

  const generateTokenRows = async (campaignId: string, key: string): Promise<TokenRow[]> => {
    const next: TokenRow[] = [];
    for (const platform of selected) {
      const handle = (handles[platform] || "").trim();
      if (!handle) continue;
      const res = await fetch("/api/internal/verification/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId, platform, handle, secret_key: key }),
      });
      const data = await res.json();
      if (res.ok) {
        next.push({
          platform,
          handle,
          display_code: data.display_code,
          expires_at: data.expires_at,
          status: "pending",
          follower_count: 0,
          follower_threshold: PLATFORM_THRESHOLDS[platform],
        });
      }
    }
    return next;
  };

  const createCampaign = async () => {
    if (selected.length === 0) {
      setError("Select at least one platform");
      return;
    }
    const missing = selected.filter((p) => !(handles[p] || "").trim());
    if (missing.length > 0) {
      setError(`Enter a handle for: ${missing.join(", ")}`);
      return;
    }
    setLoading(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/internal/verification/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_id: session.user.id,
        selected_platforms: selected,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    setCampaign({ id: data.campaign_id, business_id: session.user.id, status: "draft", selected_platforms: selected, domain: null, business_name: "" });
    setSecretKey(data.secret_key);

    const rows = await generateTokenRows(data.campaign_id, data.secret_key);
    setTokens(rows);
    setStep("tokens");
    setLoading(false);
  };

  const regenerateTokens = async () => {
    if (!campaign || !secretKey) {
      setError("Create the campaign first (secret key missing)");
      return;
    }
    setLoading(true);
    setError(null);
    const rows = await generateTokenRows(campaign.id, secretKey);
    setTokens(rows);
    setLoading(false);
  };

  const runAudit = async () => {
    if (!campaign || !secretKey) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/internal/verification/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_id: campaign.id, secret_key: secretKey }),
    });
    const data = await res.json();
    if (res.ok) {
      setAudit({
        score: data.overall_score,
        status: data.status,
        scoreStatus: data.status === "verified" ? "highly_authentic" : "suspicious",
        label: data.status === "verified" ? "Verified" : "Under Review",
      });
      setStep("score");
    } else {
      setError(data.error);
    }
    setLoading(false);
  };

  const verified = tokens.filter((t) => t.status === "verified").length;
  const unverified = selected.filter((p) => !tokens.some((t) => t.platform === p && t.status === "verified"));
  const locked = selected.length > 0 && unverified.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">SocialVerify Campaign</h1>
          <p className="text-sm text-muted-foreground">Independent verification — no API keys, no proprietary apps</p>
        </div>
        {campaign && (
          <a
            href={`/audit/business/${campaign.business_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
          >
            View public verification report ↗
          </a>
        )}
      </div>

      <LockBanner locked={locked} unverified={unverified} selectedCount={selected.length} />

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="flex gap-1 border-b border-border pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStep(tab.id)}
            className={
              step === tab.id
                ? "rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground"
                : "rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {step === "select" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium">Select platforms to verify</h2>
            <PlatformSelector selected={selected} onChange={setSelected} disabled={!!campaign && campaign.status !== "draft"} />

            {selected.length > 0 && (
              <div className="mt-4 space-y-3">
                <h3 className="text-sm font-medium">Enter your handles</h3>
                {selected.map((pf) => (
                  <div key={pf} className="flex items-center gap-3">
                    <label className="w-24 text-sm capitalize text-muted-foreground">{pf}</label>
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
              type="button"
              onClick={campaign ? () => setStep("tokens") : createCampaign}
              disabled={loading || selected.length === 0}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Loading..." : campaign ? "Continue to Tokens" : "Generate Verification Tokens"}
            </button>
          </div>
        </div>
      )}

      {step === "tokens" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-2 text-lg font-medium">🔐 Cryptographic Verification Tokens</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Post these tokens to your bio/description. They expire in 7 days.
            </p>
            <TokenDisplay tokens={tokens} />
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-2 text-lg font-medium">📋 Posting Instructions</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              {selected.includes("youtube") && (
                <div><strong className="text-foreground">YouTube:</strong> Studio → Customization → Basic Info → Description. Add your token.</div>
              )}
              {selected.includes("tiktok") && (
                <div><strong className="text-foreground">TikTok:</strong> Profile → Edit Profile → Bio. Add your token + website link.</div>
              )}
              {selected.includes("instagram") && (
                <div><strong className="text-foreground">Instagram:</strong> Profile → Edit Profile → Bio. Add your token + website link.</div>
              )}
              {selected.includes("twitter") && (
                <div><strong className="text-foreground">Twitter / X:</strong> Profile → Edit Profile → Bio. Pin a tweet with your token.</div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {tokens.length === 0 && campaign && secretKey && (
              <button
                type="button"
                onClick={regenerateTokens}
                disabled={loading}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
              >
                {loading ? "Generating..." : "Generate Tokens"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setStep("identity")}
              disabled={loading || tokens.length === 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Continue to Identity
            </button>
          </div>
        </div>
      )}

      {step === "identity" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium">🔐 Identity Binding</h2>
            <IdentityBinding
              confidence={null}
              minimumMet={false}
              proofs={[
                { name: "Domain Ownership", points: 30, description: "Add a DNS TXT record or /.well-known file proving you control your domain." },
                { name: "Bi-Directional Links", points: 20, description: "Your social bios link to your domain AND your domain links to your socials." },
                { name: "Token Persistence", points: 15, description: "Token must stay in your bio for 24 hours (checked at 6h/12h/24h)." },
                { name: "Video Proof", points: 25, optional: true, description: "Record a 10-30s video holding a sign with today's date, a unique phrase, and your face." },
                { name: "Two-Way Handshake", points: 15, optional: true, description: "10-minute challenge: change profile pic pattern, add a bio emoji, or post a story." },
              ]}
            />
          </div>
          <button type="button" onClick={() => setStep("audit")} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Continue to Audit
          </button>
        </div>
      )}

      {step === "audit" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium">🔍 Run Full Audit</h2>
            <AuditLog entries={[]} overallScore={null} status={null} />
            <button
              type="button"
              onClick={runAudit}
              disabled={loading}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Running audit..." : "Run Full Audit"}
            </button>
          </div>
        </div>
      )}

      {step === "score" && audit && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-medium">📊 Authenticity Score</h2>
            <ScoreDisplay
              score={audit.score}
              status={audit.scoreStatus}
              statusLabel={audit.label}
              breakdown={{
                engagement_rate: { value: 0, score: 0, max: 40 },
                comment_quality: { value: 0, score: 0, max: 30 },
                consistency: { value: 0, score: 0, max: 15 },
                growth_velocity: { value: 0, score: 0, max: 15 },
                cross_platform: { value: selected.length > 1, score: selected.length > 1 ? 10 : 0, max: 10 },
                challenge_bonus: { score: 0, max: 5 },
              }}
            />
          </div>
          <ScoreCalculator />
        </div>
      )}
    </div>
  );
}
