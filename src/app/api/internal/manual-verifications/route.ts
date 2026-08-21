import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { deriveVerificationToken } from "@/lib/verification-token";

export const runtime = "nodejs";
export const maxDuration = 60;

const PLATFORMS = new Set(["tiktok", "instagram", "youtube", "twitter"]);
const ALL_PLATFORMS = ["tiktok", "instagram", "youtube", "twitter"] as const;
const TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);
const MAX_BYTES = 10 * 1024 * 1024;
const BUCKET = "creator-verification";

async function getCreator() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Unauthorized" };
  const role = user.user_metadata?.role ?? user.app_metadata?.role;
  if (role !== "creator") {
    return { supabase, user: null, error: "Only creators can submit follower verification" };
  }
  return { supabase, user, error: null };
}

async function withSignedUrl(service: ReturnType<typeof createSupabaseServiceRoleClient>, row: any) {
  const path = row.storage_path || (!row.screenshot_url?.startsWith("http") ? row.screenshot_url : null);
  let screenshotUrl = row.screenshot_url?.startsWith("http") ? row.screenshot_url : null;
  if (path) {
    const { data } = await service.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    screenshotUrl = data?.signedUrl ?? screenshotUrl;
  }
  return { ...row, screenshot_url: screenshotUrl };
}

export async function GET() {
  const { user, error } = await getCreator();
  if (error || !user) return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });

  const service = createSupabaseServiceRoleClient();
  const { data, error: queryError } = await service
    .from("manual_follower_verifications")
    .select("id, platform, handle, claimed_follower_count, screenshot_url, storage_path, status, review_notes, reviewed_at, created_at, updated_at, verification_token")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  const verifications = await Promise.all((data ?? []).map((row: any) => withSignedUrl(service, row)));

  // Per-platform proof-of-ownership tokens so the creator can post one to their
  // bio BEFORE uploading the screenshot.
  const tokens = Object.fromEntries(
    ALL_PLATFORMS.map((p) => [p, deriveVerificationToken(user.id, p)]),
  );

  return NextResponse.json({ verifications, tokens });
}

export async function POST(request: NextRequest) {
  const { user, error } = await getCreator();
  if (error || !user) return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });

  const form = await request.formData().catch(() => null);
  const platform = String(form?.get("platform") ?? "").toLowerCase();
  const handle = String(form?.get("handle") ?? "").trim().replace(/^@+/, "");
  const followerCount = Number(form?.get("follower_count") ?? NaN);
  const file = form?.get("file");

  if (!PLATFORMS.has(platform)) {
    return NextResponse.json({ error: "Choose TikTok, Instagram, or YouTube" }, { status: 400 });
  }
  if (!handle || handle.length > 100) {
    return NextResponse.json({ error: "Enter a valid platform handle" }, { status: 400 });
  }
  if (!Number.isSafeInteger(followerCount) || followerCount < 0) {
    return NextResponse.json({ error: "Follower count must be a whole number" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a screenshot showing the follower count" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Screenshot must be smaller than 10MB" }, { status: 413 });
  }

  const extension = TYPES.get(file.type.toLowerCase());
  if (!extension) {
    return NextResponse.json({ error: "Use a PNG, JPEG, or WebP screenshot" }, { status: 415 });
  }

  const service = createSupabaseServiceRoleClient();
  const { data: previous } = await service
    .from("manual_follower_verifications")
    .select("storage_path")
    .eq("creator_id", user.id)
    .eq("platform", platform)
    .maybeSingle();

  const storagePath = `${user.id}/${platform}-${randomUUID()}.${extension}`;
  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const verificationToken = deriveVerificationToken(user.id, platform);
  const { data: verification, error: upsertError } = await service
    .from("manual_follower_verifications")
    .upsert(
      {
        creator_id: user.id,
        platform,
        handle,
        claimed_follower_count: followerCount,
        // Proof-of-ownership token the creator must post to their bio; shown in
        // the screenshot so the admin can confirm the account is really theirs.
        verification_token: verificationToken,
        // Kept populated for compatibility with the original schema. The real
        // object location is storage_path in the private bucket.
        screenshot_url: storagePath,
        storage_path: storagePath,
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        review_notes: null,
      },
      { onConflict: "creator_id,platform" },
    )
    .select("id, platform, handle, claimed_follower_count, screenshot_url, storage_path, status, review_notes, reviewed_at, created_at, updated_at, verification_token")
    .single();

  if (upsertError) {
    await service.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  if (previous?.storage_path && previous.storage_path !== storagePath) {
    await service.storage.from(BUCKET).remove([previous.storage_path]);
  }

  return NextResponse.json({ verification: await withSignedUrl(service, verification) }, { status: 201 });
}
