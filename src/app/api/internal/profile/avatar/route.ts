import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

export const maxDuration = 60;

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * POST /api/internal/profile/avatar
 * Uploads a profile picture / logo to the public `profile-images` bucket and
 * stamps the relevant profile column:
 *   - creator  → creator_profiles.profile_picture_url
 *   - business → business_profiles.logo_url
 *
 * Body: multipart form with field "file" (PNG/JPEG/WebP/GIF ≤ 5MB).
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large — max 5MB" }, { status: 413 });
  }

  const ext = ALLOWED_TYPES[file.type.toLowerCase()];
  if (!ext) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, WebP, or GIF images are supported" },
      { status: 415 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const key = `${user.id}/avatar-${Date.now()}.${ext}`;

  const serviceSupabase = createSupabaseServiceRoleClient();
  const { data, error } = await serviceSupabase.storage
    .from("profile-images")
    .upload(key, bytes, { contentType: file.type, upsert: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = serviceSupabase.storage
    .from("profile-images")
    .getPublicUrl(data.path);

  const url = urlData?.publicUrl ?? null;
  if (!url) {
    return NextResponse.json({ error: "Could not build public URL" }, { status: 500 });
  }

  const role = user.user_metadata?.role;
  if (role === "business") {
    await serviceSupabase
      .from("business_profiles")
      .update({ logo_url: url })
      .eq("user_id", user.id);
  } else {
    await serviceSupabase
      .from("creator_profiles")
      .update({ profile_picture_url: url })
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true, url, path: data.path }, { status: 201 });
}
