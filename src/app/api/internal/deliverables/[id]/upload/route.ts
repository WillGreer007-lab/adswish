import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * POST /api/internal/deliverables/:id/upload
 * Direct MP4 upload to Supabase Storage (bucket: deliverable-videos), then
 * stamps deliverables.video_url. Phase 6 v1: single MP4 ≤ 50MB.
 *
 * Request body: multipart form with field "file" (the MP4).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = createSupabaseServiceRoleClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Only the assigned creator may upload to their deliverable.
  const { data: deliverable } = await supabase
    .from("deliverables")
    .select("id, creator_id, status")
    .eq("id", id)
    .single();

  if (!deliverable) {
    return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
  }
  if (deliverable.creator_id !== user.id) {
    return NextResponse.json({ error: "Not your deliverable" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Video too large — max 50MB" },
      { status: 413 },
    );
  }

  const type = file.type.toLowerCase();
  if (type !== "video/mp4" && !file.name.toLowerCase().endsWith(".mp4")) {
    return NextResponse.json(
      { error: "Only MP4 videos are supported" },
      { status: 415 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const key = `${user.id}/${id}-${Date.now()}.mp4`;

  const { data, error } = await supabase.storage
    .from("deliverable-videos")
    .upload(key, bytes, { contentType: "video/mp4", upsert: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("deliverable-videos")
    .getPublicUrl(data.path);

  const videoUrl = urlData?.publicUrl ?? null;

  await supabase
    .from("deliverables")
    .update({ video_url: videoUrl })
    .eq("id", id);

  return NextResponse.json(
    { ok: true, video_url: videoUrl, path: data.path },
    { status: 201 },
  );
}
