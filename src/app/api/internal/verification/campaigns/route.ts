import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHmac } from "node:crypto";
import type { SocialPlatform } from "@/lib/verification-token";
import { PLATFORM_THRESHOLDS } from "@/lib/verification-token";
import {
  validatePlatformSelection,
  computeCampaignStatus,
  type CampaignStatus,
} from "@/lib/campaign-verification";

/**
 * POST /api/internal/verification/campaigns
 * Create a new verification campaign.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { business_id, domain, business_name, selected_platforms } = body;

  if (!business_id || !Array.isArray(selected_platforms) || selected_platforms.length === 0) {
    return NextResponse.json(
      { error: "business_id and selected_platforms (non-empty array) required" },
      { status: 400 },
    );
  }

  const validation = validatePlatformSelection(selected_platforms);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join(", ") }, { status: 400 });
  }

  // Verify business ownership
  const { data: business } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", business_id)
    .single();

  if (!business || business.user_id !== user.id) {
    return NextResponse.json({ error: "Business not found or unauthorized" }, { status: 403 });
  }

  // Generate a secret key for this campaign
  const secretKey = randomBytes(32).toString("hex");
  const secretKeyHash = createHmac("sha256", "adswish-campaign-secrets")
    .update(secretKey)
    .digest("hex");

  const { data: campaign, error: insertError } = await supabase
    .from("verification_campaigns")
    .insert({
      business_id,
      domain: domain || null,
      business_name: business_name || "",
      secret_key_hash: secretKeyHash,
      status: "draft",
      selected_platforms: selected_platforms,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    campaign_id: campaign.id,
    secret_key: secretKey, // returned once — caller must store securely
    status: campaign.status,
  });
}

/**
 * GET /api/internal/verification/campaigns?business_id=...
 * List verification campaigns for a business.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("business_id");
  if (!businessId) {
    return NextResponse.json({ error: "business_id required" }, { status: 400 });
  }

  // Verify business ownership
  const { data: business } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessId)
    .single();

  if (!business || business.user_id !== user.id) {
    return NextResponse.json({ error: "Business not found or unauthorized" }, { status: 403 });
  }

  const { data: campaigns, error } = await supabase
    .from("verification_campaigns")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaigns });
}
