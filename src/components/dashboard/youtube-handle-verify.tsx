"use client";

import { useState } from "react";
import { Loader2, Check, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type VerifiedYouTubeAccount = {
  handle: string;
  follower_count: number;
};

/**
 * Self-serve YouTube verification. Paste a channel handle; we fetch the live
 * subscriber count via the YouTube Data API (no OAuth). To prove ownership the
 * creator must add their per-account challenge code to the channel's About
 * description, then click Verify again — so nobody can claim a channel they
 * don't control. No screenshot and no admin approval.
 */
export function YouTubeHandleVerify({ onVerified }: { onVerified?: (account: VerifiedYouTubeAccount) => void }) {
  const [handle, setHandle] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<{ code: string; handle: string } | null>(null);

  async function verify() {
    const clean = handle.trim();
    if (!clean || verifying) return;
    setVerifying(true);
    setError(null);
    setSuccess(null);
    setChallenge(null);
    try {
      const res = await fetch("/api/internal/oauth/youtube/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.needs_bio_proof) {
        setChallenge({ code: data.code, handle: data.handle });
        return;
      }
      if (!res.ok) {
        setError(data?.error ?? "Couldn't verify that YouTube channel.");
        return;
      }
      setSuccess(`YouTube verified — ${Number(data.follower_count ?? 0).toLocaleString()} subscribers.`);
      setHandle("");
      onVerified?.({ handle: data.handle, follower_count: Number(data.follower_count ?? 0) });
    } catch {
      setError("Network error — try again.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              verify();
            }
          }}
          placeholder="YouTube handle (e.g. @PewDiePie)"
          className="h-9 w-full max-w-[260px]"
          disabled={verifying}
          aria-label="YouTube handle"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={verify}
          disabled={verifying || !handle.trim()}
          className="gap-2"
        >
          {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Verify
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-success">{success}</p>}

      {challenge && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-warning">
            <Youtube className="h-4 w-4" /> Prove you own @{challenge.handle}
          </p>
          <p className="mt-1 text-muted-foreground">
            Add this code to your YouTube channel&apos;s <strong>About</strong> description, save it,
            then click <strong>Verify</strong> again:
          </p>
          <code className="mt-2 inline-block rounded bg-muted px-2 py-1 font-mono text-base font-bold tracking-wider">
            {challenge.code}
          </code>
          <p className="mt-2 text-xs text-muted-foreground">
            You can remove the code from your About section after verification. Without this, anyone
            could claim a channel they don&apos;t control — the code proves it&apos;s really yours.
          </p>
        </div>
      )}
    </div>
  );
}
