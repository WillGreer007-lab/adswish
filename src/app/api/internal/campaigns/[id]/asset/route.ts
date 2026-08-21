import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO = ["video/mp4", "video/webm"];

function extensionFor(type: string, name: string): string {
  const fromName = name.split(".").pop()?.toLowerCase();
  if (type.startsWith("video/")) return "mp4";
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return fromName && /^[a-z0-9]{2,5}$/.test(fromName) ? fromName : "bin";
}

/**
 * POST /api/internal/campaigns/:id/asset
 * Upload a campaign preview image (JPEG/PNG/WebP/GIF) or short video (MP4/WebM)
 * to the public `campaign-assets` bucket and stamp `campaigns.asset_url`.
 * Only the campaign's owning business may upload.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const service = createSupabaseServiceRoleClient();

  const { data: campaign } = await service
    .from("campaigns")
    .select("id, business_id, asset_url")
    .eq("id", id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (campaign.business_id !== user.id) {
    return NextResponse.json({ error: "Not your campaign" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large — max 25MB" }, { status: 413 });
  }

  const type = file.type.toLowerCase();
  const isImage = ALLOWED_IMAGE.includes(type);
  const isVideo = ALLOWED_VIDEO.includes(type);
  if (!isImage && !isVideo) {
    return NextResponse.json(
      { error: "Unsupported type — use JPEG, PNG, WebP, GIF, MP4, or WebM" },
      { status: 415 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const key = `${user.id}/${id}-${Date.now()}.${extensionFor(type, file.name)}`;
  const contentType = type || "application/octet-stream";

  const { data, error } = await service.storage
    .from("campaign-assets")
    .upload(key, bytes, { contentType, upsert: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = service.storage
    .from("campaign-assets")
    .getPublicUrl(data.path);

  const assetUrl = urlData?.publicUrl ?? null;

  await service
    .from("campaigns")
    .update({ asset_url: assetUrl })
    .eq("id", id);

  // Remove the previous asset if it was stored in this bucket (avoids orphans).
  if (campaign.asset_url) {
    const oldPath = campaign.asset_url.split("/campaign-assets/")[1];
    if (oldPath && oldPath !== data.path) {
      await service.storage.from("campaign-assets").remove([oldPath]);
    }
  }

  return NextResponse.json(
    { ok: true, asset_url: assetUrl, path: data.path },
    { status: 201 },
  );
}
