import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail, teamInviteEmailHtml } from "@/lib/email";

/**
 * Team seat lifecycle (blueprint §15):
 *   POST   /api/internal/team           invite by email (owner only, seat-limited)
 *   GET    /api/internal/team           list members (pending + active)
 *   PATCH  /api/internal/team           accept an invite (invitee) or decline
 *   DELETE /api/internal/team           revoke / remove a member (owner only)
 */

function teamSeatsForPlan(features: unknown): number {
  const f = (features ?? {}) as { team_seats?: number };
  return typeof f.team_seats === "number" ? f.team_seats : 1; // owner always counts as 1
}

/** The authenticated user's business (owner) id, or null if not a business. */
async function resolveBusiness(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) {
  const { data } = await supabase
    .from("business_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.user_id ?? null;
}

/** GET — list this business's team members. */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // A team member (not the owner) has app_metadata.business_id; use it to list
  // their team. Owners list by their own id.
  const ownerId = (user.app_metadata?.business_id as string | undefined) ?? user.id;
  const { data: members } = await supabase
    .from("business_team_members")
    .select("business_id, user_id, role, invited_at, joined_at")
    .eq("business_id", ownerId)
    .order("invited_at", { ascending: false });

  return NextResponse.json({ members: members ?? [] });
}

/** POST — invite a teammate by email (owner only, seat limit enforced). */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = await resolveBusiness(supabase, user.id);
  if (!businessId) {
    return NextResponse.json({ error: "Only business accounts can invite team members" }, { status: 403 });
  }

  const { email, role } = (await request.json().catch(() => ({}))) as {
    email?: string;
    role?: string;
  };
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (email.trim().toLowerCase() === user.email?.toLowerCase()) {
    return NextResponse.json({ error: "You cannot invite yourself" }, { status: 400 });
  }

  const service = createSupabaseServiceRoleClient();

  // Seat limit: plan features define team_seats (Growth 2, Enterprise 5, Free 1).
  const { data: sub } = await service
    .from("business_subscriptions")
    .select("plan_slug")
    .eq("business_id", businessId)
    .eq("status", "active")
    .maybeSingle();
  const { data: plan } = await service
    .from("subscription_plans")
    .select("features")
    .eq("slug", sub?.plan_slug ?? "business_free")
    .single();
  const seatLimit = teamSeatsForPlan(plan?.features);

  const { count: memberCount } = await service
    .from("business_team_members")
    .select("user_id", { count: "exact", head: true })
    .eq("business_id", businessId);
  const used = memberCount ?? 1; // owner row isn't in the table; seats are owner + members
  if (used + 1 > seatLimit) {
    return NextResponse.json(
      { error: `Your plan allows ${seatLimit} team seat(s) (${used} in use). Upgrade for more.` },
      { status: 422 },
    );
  }

  // Find or create the invitee.
  const { data: existing, error: listError } = await service.auth.admin.listUsers();
  if (listError) return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  const invitedUser = (existing.users ?? []).find(
    (u: { email?: string | null }) => u.email?.toLowerCase() === email.trim().toLowerCase(),
  );

  if (invitedUser) {
    await service.auth.admin.updateUserById(invitedUser.id, {
      app_metadata: { business_id: businessId, role: "team_member" },
    });
    const { data: existingMember } = await service
      .from("business_team_members")
      .select("joined_at")
      .eq("business_id", businessId)
      .eq("user_id", invitedUser.id)
      .maybeSingle();
    if (existingMember) {
      return NextResponse.json(
        { error: "That person is already on your team" },
        { status: 409 },
      );
    }
    await service.from("business_team_members").insert({
      business_id: businessId,
      user_id: invitedUser.id,
      role: role === "admin" ? "admin" : "member",
      invited_at: new Date().toISOString(),
      joined_at: null, // pending acceptance
    });

    // Existing user: they can already log in, so link straight to the team page.
    await sendTeamInviteEmail(service, businessId, email.trim(), false);
    return NextResponse.json({ success: true, message: "Invitation sent" }, { status: 201 });
  }

  // New invitee: create unconfirmed + passwordless, then send a password-set
  // (invite) link so they can confirm their email AND choose a password.
  const { data: newUser, error: createError } = await service.auth.admin.createUser({
    email: email.trim(),
    email_confirm: false,
    app_metadata: { business_id: businessId, role: "team_member" },
  });
  if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });

  await service.from("business_team_members").insert({
    business_id: businessId,
    user_id: newUser.user.id,
    role: role === "admin" ? "admin" : "member",
    invited_at: new Date().toISOString(),
    joined_at: null,
  });

  await sendTeamInviteEmail(service, businessId, email.trim(), true);
  return NextResponse.json({ success: true, message: "Invitation sent" }, { status: 201 });
}

/** PATCH — accept or decline an invite (the invitee's own action). */
export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = (await request.json().catch(() => ({}))) as { action?: string };
  if (!["accept", "decline"].includes(action ?? "")) {
    return NextResponse.json({ error: "action must be accept or decline" }, { status: 400 });
  }

  const businessId = user.app_metadata?.business_id as string | undefined;
  if (!businessId) {
    return NextResponse.json({ error: "You have no pending team invite" }, { status: 404 });
  }

  const service = createSupabaseServiceRoleClient();

  if (action === "decline") {
    // Remove the membership and the team tag.
    await service.from("business_team_members").delete().eq("business_id", businessId).eq("user_id", user.id);
    await service.auth.admin.updateUserById(user.id, {
      app_metadata: { ...(user.app_metadata ?? {}), business_id: null, role: null },
    });
    await notifyOwner(service, businessId, user.email ?? "A teammate", "declined");
    return NextResponse.json({ success: true, accepted: false });
  }

  const { data: member } = await service
    .from("business_team_members")
    .select("joined_at")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "No team invite found for your account" }, { status: 404 });
  }
  if (member.joined_at) {
    return NextResponse.json({ success: true, accepted: true, already: true });
  }

  await service
    .from("business_team_members")
    .update({ joined_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("user_id", user.id);

  await notifyOwner(service, businessId, user.email ?? "A teammate", "accepted");
  return NextResponse.json({ success: true, accepted: true });
}

/** DELETE — revoke / remove a member (owner only). Body: { user_id }. */
export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = await resolveBusiness(supabase, user.id);
  if (!businessId) {
    return NextResponse.json({ error: "Only business owners can remove team members" }, { status: 403 });
  }

  const { user_id } = (await request.json().catch(() => ({}))) as { user_id?: string };
  if (!user_id) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  const service = createSupabaseServiceRoleClient();
  const { data: member } = await service
    .from("business_team_members")
    .select("user_id")
    .eq("business_id", businessId)
    .eq("user_id", user_id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  await service.from("business_team_members").delete().eq("business_id", businessId).eq("user_id", user_id);
  await service.auth.admin.updateUserById(user_id, {
    app_metadata: { ...((await service.auth.admin.getUserById(user_id)).data.user?.app_metadata ?? {}), business_id: null, role: null },
  });

  return NextResponse.json({ success: true, revoked: true });
}

/**
 * Send the invite email via Resend. Failure is non-fatal — the invite is still
 * recorded, and a pending invite is visible in the dashboard regardless of
 * whether the email went out (e.g. before Resend DNS is verified).
 */
async function sendTeamInviteEmail(
  service: ReturnType<typeof createSupabaseServiceRoleClient>,
  businessId: string,
  inviteeEmail: string,
  isNewUser: boolean,
): Promise<void> {
  try {
    const { data: biz } = await service
      .from("business_profiles")
      .select("company_name")
      .eq("user_id", businessId)
      .maybeSingle();
    const companyName = biz?.company_name ?? "A business";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const teamUrl = `${appUrl}/dashboard/business/profile`;

    // New invitees need a password-set link (they were created with
    // email_confirm:false). Existing users can sign in already.
    let href = teamUrl;
    if (isNewUser) {
      try {
        const { data: link } = await service.auth.admin.generateLink({
          type: "invite",
          email: inviteeEmail,
          options: { redirectTo: teamUrl },
        });
        const actionLink = (link as { properties?: { action_link?: string } })?.properties?.action_link;
        if (actionLink) href = actionLink;
      } catch {
        /* keep the fallback team-page link */
      }
    }

    await sendEmail({
      to: inviteeEmail,
      subject: `${companyName} invited you to their Adswish team`,
      text: isNewUser
        ? `${companyName} invited you to join their team on Adswish. Set your password to accept: ${href}`
        : `${companyName} invited you to join their team on Adswish. Sign in and accept the invite: ${href}`,
      html: teamInviteEmailHtml(companyName, href),
    });
  } catch {
    /* non-fatal — the pending invite still shows in the dashboard */
  }
}

/** Notify the business owner when a teammate accepts or declines. */
async function notifyOwner(
  service: ReturnType<typeof createSupabaseServiceRoleClient>,
  businessId: string,
  inviteeEmail: string,
  action: "accepted" | "declined",
): Promise<void> {
  try {
    await service.from("notifications").insert({
      user_id: businessId,
      type: "system",
      body: `${inviteeEmail} ${action} your team invitation.`,
      link: "/dashboard/business/profile",
    });
  } catch {
    /* non-fatal */
  }
}
