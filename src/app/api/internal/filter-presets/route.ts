import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = new URL(request.url).searchParams.get("role") || "creator";

  const { data: presets, error } = await supabase
    .from("filter_presets")
    .select("*")
    .eq("user_id", user.id)
    .eq("role", role)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ presets });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, role = "creator", filters } = body;

  if (!name || !filters) {
    return NextResponse.json({ error: "name and filters are required" }, { status: 400 });
  }

  // Preset caps: 5 for free creators, unlimited for Pro/Premium, 10 for businesses.
  const { data: existing } = await supabase
    .from("filter_presets")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", role);

  let cap = 10;
  if (role === "creator") {
    const { data: subscription } = await supabase
      .from("creator_subscriptions")
      .select("plan_slug")
      .eq("creator_id", user.id)
      .eq("status", "active")
      .single();
    const isFree = !subscription || subscription.plan_slug === "creator_free";
    cap = isFree ? 5 : Infinity;
  }

  if (existing && existing.length >= cap) {
    return NextResponse.json({ error: `Preset limit reached (${cap}).` }, { status: 422 });
  }

  const { data: preset, error } = await supabase
    .from("filter_presets")
    .insert({ user_id: user.id, role, name, filters })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ preset });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("filter_presets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
