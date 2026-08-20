import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export type ThumbnailDeliverable = {
  id: string;
  campaign_id: string;
  video_url: string | null;
};

export type ThumbnailResult = {
  generated: number;
  failed: boolean;
  error?: string;
};

const VARIANTS = [
  { variant: "variant_a", offset: 0.1 },
  { variant: "variant_b", offset: 0.5 },
  { variant: "variant_c", offset: 0.9 },
] as const;

/**
 * Locate the ffmpeg binary. ffmpeg-static is a normal dependency; on a
 * serverless runtime where the binary can't be traced it's simply absent and
 * we degrade to a clear error instead of crashing.
 *
 * Note: in `next dev`, the bundler rewrites the module's path to a virtual
 * `/ROOT/node_modules/…` location that doesn't exist on disk — so we fall back
 * to the real node_modules binary when the bundled path is the virtual one.
 */
async function ffmpegPath(): Promise<string | null> {
  try {
    const mod = (await import("ffmpeg-static")) as { default?: string };
    const bundled = mod.default;
    const candidates: (string | undefined)[] = [bundled];
    if (bundled && bundled.startsWith("/ROOT/")) {
      candidates.push(join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"));
    }
    for (const c of candidates) {
      if (c && existsSync(c)) return c;
    }
    return null;
  } catch {
    return null;
  }
}

/** Ensure the public storage bucket for A/B assets exists (idempotent). */
export async function ensureAssetBucket(): Promise<void> {
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.storage.createBucket("google-ads-assets", {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
  });
  if (error && !/already exists/i.test(error.message)) {
    // Only surface real failures — "already exists" is the expected second run.
    throw error;
  }
}

/** Parse duration (seconds) from ffmpeg's stderr output. */
function probeDuration(ffmpeg: string, input: string): Promise<{ seconds: number; stderr: string } | null> {
  return new Promise((resolve) => {
    const proc = spawn(ffmpeg, ["-i", input, "-f", "null", "-"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => (stderr += String(d)));
    proc.on("close", () => {
      const m = stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!m) return resolve(null);
      resolve({
        seconds: Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]),
        stderr,
      });
    });
    proc.on("error", () => resolve(null));
  });
}

/** Extract a single frame at `atSeconds` into `output`. */
function extractFrame(
  ffmpeg: string,
  input: string,
  output: string,
  atSeconds: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(
      ffmpeg,
      ["-ss", String(atSeconds), "-i", input, "-frames:v", "1", "-q:v", "2", "-y", output],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

async function insertFailed(
  deliverable: ThumbnailDeliverable,
  businessUserId: string,
  message: string,
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient();
  await supabase.from("deliverable_ab_assets").insert(
    VARIANTS.map((v) => ({
      deliverable_id: deliverable.id,
      campaign_id: deliverable.campaign_id,
      user_id: businessUserId,
      variant: v.variant,
      status: "failed",
      error: message,
    })),
  );
}

/**
 * Extract three A/B thumbnail frames (10% / 50% / 90% of the video) from an
 * approved deliverable's MP4 and store them as ready assets. Idempotent: any
 * previous assets for the deliverable are replaced. On any failure the
 * deliverable gets three `failed` rows carrying the error, so the UI can show
 * why instead of silently doing nothing.
 */
export async function generateDeliverableThumbnails(
  deliverable: ThumbnailDeliverable,
  businessUserId: string,
): Promise<ThumbnailResult> {
  const supabase = createSupabaseServiceRoleClient();

  // Clear previous attempts so regeneration is idempotent.
  await supabase
    .from("deliverable_ab_assets")
    .delete()
    .eq("deliverable_id", deliverable.id);

  if (!deliverable.video_url) {
    await insertFailed(deliverable, businessUserId, "No video attached to this deliverable.");
    return { generated: 0, failed: true, error: "No video attached to this deliverable." };
  }

  const ffmpeg = await ffmpegPath();
  if (!ffmpeg) {
    const msg = "FFmpeg is not available on this server — thumbnails can't be extracted yet.";
    await insertFailed(deliverable, businessUserId, msg);
    return { generated: 0, failed: true, error: msg };
  }

  let dir: string | null = null;
  try {
    await ensureAssetBucket();

    const res = await fetch(deliverable.video_url);
    if (!res.ok) throw new Error(`Could not download the video (HTTP ${res.status}).`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) {
      throw new Error("The video downloaded as an empty file — check the storage bucket.");
    }

    dir = await mkdtemp(join(tmpdir(), "adswish-thumb-"));
    const input = join(dir, "input.mp4");
    await writeFile(input, buf);

    const probed = await probeDuration(ffmpeg, input);
    if (!probed) throw new Error("Could not read the video duration.");
    const duration = probed.seconds;

    let generated = 0;
    for (const v of VARIANTS) {
      const at = Math.max(0, Math.min(duration - 0.1, duration * v.offset));
      const out = join(dir, `${v.variant}.jpg`);
      const ok = await extractFrame(ffmpeg, input, out, at);
      if (!ok) continue;

      const jpg = await readFile(out);
      const key = `${businessUserId}/${deliverable.id}/${v.variant}-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from("google-ads-assets")
        .upload(key, jpg, { contentType: "image/jpeg", upsert: true });
      if (error) continue;

      const { data: urlData } = supabase.storage.from("google-ads-assets").getPublicUrl(data.path);
      await supabase.from("deliverable_ab_assets").insert({
        deliverable_id: deliverable.id,
        campaign_id: deliverable.campaign_id,
        user_id: businessUserId,
        variant: v.variant,
        source: "auto",
        image_url: urlData?.publicUrl ?? null,
        status: "ready",
      });
      generated++;
    }

    if (generated === 0) {
      throw new Error("Frame extraction produced no images — the video may be unsupported.");
    }
    return { generated, failed: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await insertFailed(deliverable, businessUserId, message);
    return { generated: 0, failed: true, error: message };
  } finally {
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
