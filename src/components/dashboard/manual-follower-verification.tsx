"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, ImagePlus, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

 type Platform = "tiktok" | "instagram" | "youtube";
 type Verification = {
  id: string;
  platform: Platform;
  handle: string;
  claimed_follower_count: number | null;
  screenshot_url: string | null;
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
 };

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
];

export function ManualFollowerVerification() {
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [handle, setHandle] = useState("");
  const [followerCount, setFollowerCount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/internal/manual-verifications")
      .then(async (response) => ({ response, data: await response.json().catch(() => ({})) }))
      .then(({ response, data }) => {
        if (!mounted) return;
        if (response.ok) setVerifications(data.verifications ?? []);
        else if (response.status !== 401) setError(data.error ?? "Could not load verification status");
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setError("Could not load verification status");
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);
    setError(null);
    setMessage(null);

    if (!file) {
      setError("Choose a screenshot showing the platform and follower count.");
      setUploading(false);
      return;
    }

    const form = new FormData();
    form.append("platform", platform);
    form.append("handle", handle);
    form.append("follower_count", followerCount);
    form.append("file", file);

    try {
      const response = await fetch("/api/internal/manual-verifications", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Upload failed");
      setVerifications((current) => [
        data.verification,
        ...current.filter((item) => item.platform !== platform),
      ]);
      setFile(null);
      setMessage(`${PLATFORMS.find((item) => item.id === platform)?.label} proof submitted for admin review.`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const statusIcon = (status: Verification["status"]) => {
    if (status === "approved") return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (status === "rejected") return <XCircle className="h-4 w-4 text-destructive" />;
    return <Clock3 className="h-4 w-4 text-warning" />;
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div>
        <h3 className="font-heading text-sm font-semibold">Manual follower verification</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          If TikTok, Instagram, or YouTube Connect is unavailable, upload one screenshot per platform. Your follower count stays unverified until an admin approves it.
        </p>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading submissions…</div>
      ) : (
        <div className="mt-4 space-y-2">
          {verifications.map((verification) => (
            <div key={verification.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
              {statusIcon(verification.status)}
              <span className="font-medium capitalize">{verification.platform}</span>
              <span className="text-sm text-muted-foreground">@{verification.handle}</span>
              <span className="font-mono text-sm">{Number(verification.claimed_follower_count ?? 0).toLocaleString()}</span>
              <span className="ml-auto text-xs capitalize text-muted-foreground">{verification.status}</span>
              {verification.review_notes && <span className="basis-full text-xs text-destructive">{verification.review_notes}</span>}
            </div>
          ))}
          {verifications.length === 0 && <p className="text-xs text-muted-foreground">No manual submissions yet.</p>}
        </div>
      )}

      <form onSubmit={submit} className="mt-5 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="manual-platform">Platform</Label>
            <select id="manual-platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm">
              {PLATFORMS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="manual-handle">Handle</Label>
            <Input id="manual-handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourname" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="manual-followers">Followers</Label>
            <Input id="manual-followers" type="number" min="0" value={followerCount} onChange={(e) => setFollowerCount(e.target.value)} placeholder="5000" required />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary">
          <ImagePlus className="h-4 w-4" />
          <span>{file ? file.name : "Choose screenshot (PNG, JPEG, or WebP; max 10MB)"}</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-success">{message}</p>}
        <Button type="submit" disabled={uploading}>
          {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : "Submit for review"}
        </Button>
      </form>
    </div>
  );
}
