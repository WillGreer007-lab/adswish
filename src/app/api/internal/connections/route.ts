import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

type ProfileInfo = { id: string; name: string; role: "creator" | "business"; avatar: string | null };

async function resolveProfiles(service: ReturnType<typeof createSupabaseServiceRoleClient>, ids: string[]) {
  const map = new Map<string, ProfileInfo>();
  if (ids.length === 0) return map;

  const [creators, businesses] = await Promise.all([
    service.from("creator_profiles").select("user_id, display_name, profile_picture_url").in("user_id", ids),
    service.from("business_profiles").select("user_id, company_name, logo_url").in("user_id", ids),
  ]);

  for (const c of creators.data ?? []) {
    map.set(c.user_id, { id: c.user_id, name: c.display_name || "Creator", role: "creator", avatar: c.profile_picture_url });
  }
  for (const b of businesses.data ?? []) {
    map.set(b.user_id, { id: b.user_id, name: b.company_name || "Business", role: "business", avatar: b.logo_url });
  }
  return map;
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: rows } = await supabase
    .from("connections")
    .select("id, requester_id, addressee_id, status, created_at")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const otherIds = (rows ?? []).map((r) => (r.requester_id === user.id ? r.addressee_id : r.requester_id));
  const profiles = await resolveProfiles(createSupabaseServiceRoleClient(), otherIds);

  const friends: unknown[] = [];
  const incoming: unknown[] = [];
  const outgoing: unknown[] = [];

  for (const r of rows ?? []) {
    const otherId = r.requester_id === user.id ? r.addressee_id : r.requester_id;
    const entry = { ...r, other: profiles.get(otherId) ?? { id: otherId, name: "User", role: "creator", avatar: null } };
    if (r.status === "accepted") friends.push(entry);
    else if (r.status === "pending" && r.addressee_id === user.id) incoming.push(entry);
    else if (r.status === "pending" && r.requester_id === user.id) outgoing.push(entry);
  }

  return NextResponse.json({ friends, incoming, outgoing });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const addresseeId = body?.addressee_id;
  if (!addresseeId || addresseeId === user.id) {
    return NextResponse.json({ error: "Invalid addressee" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("connections")
    .select("id, status")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`,
    )
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ connection: existing, exists: true });
  }

  const { data, error } = await supabase
    .from("connections")
    .insert({ requester_id: user.id, addressee_id: addresseeId, status: "pending" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ connection: data, exists: false }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { connection_id, action } = body ?? {};

  if (!connection_id || !["accept", "reject"].includes(action)) {
    return NextResponse.json({ error: "connection_id and action (accept|reject) required" }, { status: 400 });
  }

  const { data: connection } = await supabase
    .from("connections")
    .select("id, addressee_id, status")
    .eq("id", connection_id)
    .single();

  if (!connection || connection.addressee_id !== user.id || connection.status !== "pending") {
    return NextResponse.json({ error: "Connection not found or not actionable" }, { status: 404 });
  }

  const { error } = await supabase
    .from("connections")
    .update({ status: action === "accept" ? "accepted" : "declined", updated_at: new Date().toISOString() })
    .eq("id", connection_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: action === "accept" ? "accepted" : "declined" });
}
