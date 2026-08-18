import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, role } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const { data: businessProfile } = await supabase
    .from("business_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .single();

  if (!businessProfile) {
    return NextResponse.json({ error: "Only business accounts can invite team members" }, { status: 403 });
  }

  const serviceClient = createSupabaseServiceRoleClient();

  const { data: existingUsers, error: listError } = await serviceClient.auth.admin.listUsers();
  if (listError) {
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }

  const invitedUser = existingUsers.users.find((u: { email?: string }) => u.email === email);

  if (invitedUser) {
    await serviceClient.auth.admin.updateUserById(invitedUser.id, {
      app_metadata: { business_id: user.id, role: "team_member" },
    });

    await supabase.from("business_team_members").upsert({
      business_id: user.id,
      user_id: invitedUser.id,
      role: role || "member",
      invited_at: new Date().toISOString(),
    }, { onConflict: "business_id,user_id" });

    return NextResponse.json({ success: true, message: "User invited to team" });
  }

  const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { business_id: user.id, role: "team_member" },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  await supabase.from("business_team_members").insert({
    business_id: user.id,
    user_id: newUser.user.id,
    role: role || "member",
    invited_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, message: "Invitation sent" });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: members } = await supabase
    .from("business_team_members")
    .select("*")
    .eq("business_id", user.id)
    .order("invited_at", { ascending: false });

  return NextResponse.json({ members });
}
