"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm";

/**
 * Campaign preview asset picker. Holds the chosen File in state and exposes
 * `upload(campaignId)` so the parent can persist it *after* the campaign row
 * exists. Returns null when nothing was chosen.
 */
export function CampaignAssetUpload({
  onFile,
}: {
  onFile: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError("File too large — max 25MB");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    onFile(f);
  }

  function clear() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setError(null);
    onFile(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <ImagePlus className="h-4 w-4" />
          Upload preview image / video
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        {file && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {preview && (
        <div className="relative overflow-hidden rounded-lg border border-border">
          {file?.type.startsWith("video/") ? (
            <video src={preview} controls className="max-h-48 w-full object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Campaign asset preview" className="max-h-48 w-full object-contain" />
          )}
        </div>
      )}

      {file && (
        <p className="text-xs text-muted-foreground">
          {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB) — uploaded when you save the campaign.
        </p>
      )}
    </div>
  );
}

/**
 * Upload a chosen File to a campaign after it has been created. Returns the
 * public asset URL, or null when no file is provided / the upload fails.
 */
export async function uploadCampaignAsset(
  campaignId: string,
  file: File | null,
): Promise<string | null> {
  if (!file) return null;
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/internal/campaigns/${campaignId}/asset`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.asset_url ?? null;
}
