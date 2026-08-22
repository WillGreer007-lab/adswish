import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "node:crypto";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import type { SocialPlatform } from "@/lib/socialverify/tokens";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_PLATFORMS = new Set<SocialPlatform>(["youtube", "tiktok", "instagram", "twitter"]);

function hashSecret(secretKey: string): string {
  return createHmac("sha256", "adswish-campaign-secrets").update(secretKey).digest("hex");
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { business_id, domain, business_name, selected_platforms } = body ?? {};

  if (!business_id || !Array.isArray(selected_platforms) || selected_platforms.length === 0) {
    return NextResponse.json(
      { error: "business_id and selected_platforms (non-empty array) are required" },
      { status: 400 },
    );
  }

  const invalid = selected_platforms.filter((p: string) => !VALID_PLATFORMS.has(p as SocialPlatform));
  if (invalid.length > 0) return NextResponse.json({ error: `Unknown platforms: ${invalid.join(", ")}` }, { status: 400 });
  if (new Set(selected_platforms).size !== selected_platforms.length) {
    return NextResponse.json({ error: "Duplicate platforms in selection" }, { status: 400 });
  }

  // business_id is the auth user id that owns the business profile.
  if (business_id !== user.id) {
    return NextResponse.json({ error: "Business not found or unauthorized" }, { status: 403 });
  }

  const secretKey = randomBytes(32).toString("hex");
  const service = createSupabaseServiceRoleClient();

  const { data: campaign, error } = await service
    .from("verification_campaigns")
    .insert({
      business_id,
      domain: domain || null,
      business_name: business_name || "",
      secret_key_hash: hashSecret(secretKey),
      status: "draft",
      selected_platforms,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return the secret key exactly once — the client must persist it securely.
  return NextResponse.json({ campaign_id: campaign.id, secret_key: secretKey, status: campaign.status }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = new URL(request.url).searchParams.get("business_id");
  if (!businessId) return NextResponse.json({ error: "business_id is required" }, { status: 400 });
  if (businessId !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service
    .from("verification_campaigns")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data ?? [] });
}
