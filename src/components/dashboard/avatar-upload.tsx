"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";

export function AvatarUpload({
  role,
  currentUrl,
  name,
}: {
  role: "creator" | "business";
  currentUrl: string | null;
  name: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/internal/profile/avatar", {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Upload failed");
      }
      setPreview(json.url);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <div
          className={
            role === "business"
              ? "flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted"
              : "flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-muted"
          }
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-muted-foreground">
              {name?.charAt(0)?.toUpperCase() || "?"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-sm transition-colors hover:text-primary disabled:opacity-60"
          aria-label="Upload picture"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {role === "business" ? "Company logo" : "Profile picture"}
        </p>
        <p className="text-xs text-muted-foreground">PNG, JPEG, WebP, or GIF · max 5MB</p>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
