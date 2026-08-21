import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Building2, Users2 } from "lucide-react";
import { AvatarUpload } from "@/components/dashboard/avatar-upload";
import { TeamManagement } from "@/components/dashboard/team-management";

export default async function BusinessProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const { upgrade } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard");

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // A team member (invited by an owner) has app_metadata.business_id but no
  // business_profiles row of their own. Show the invite accept/decline UI.
  const invitedBusinessId = user.app_metadata?.business_id as string | undefined;
  const isTeamMember = !profile && invitedBusinessId && invitedBusinessId !== user.id;

  if (!profile && !isTeamMember) redirect("/onboarding");

  const { data: team } = await supabase
    .from("business_team_members")
    .select("business_id, user_id, role, invited_at, joined_at")
    .eq("business_id", isTeamMember ? invitedBusinessId : user.id);

  // A team member's own membership row drives the pending-invite banner.
  const ownMembership = isTeamMember
    ? (team ?? []).find((m) => m.user_id === user.id)
    : null;
  const pendingInvite = Boolean(isTeamMember && ownMembership && !ownMembership.joined_at);

  // Team members render the owner's company (they have no profile row).
  const { data: ownerProfile } = isTeamMember
    ? await supabase.from("business_profiles").select("*").eq("user_id", invitedBusinessId).single()
    : { data: null };
  const displayProfile = profile ?? ownerProfile;

  const subscriptionBusinessId = isTeamMember ? invitedBusinessId : user.id;
  const { data: subscription } = await supabase
    .from("business_subscriptions")
    .select("plan_slug, status")
    .eq("business_id", subscriptionBusinessId)
    .single();

  const planBadge = subscription?.plan_slug
    ? subscription.plan_slug.replace("business_", "").replace("_", " ").replace(/^\w/, (c: string) => c.toUpperCase())
    : "Free";

  return (
    <DashboardShell role="business" userId={user.id} userName={displayProfile?.company_name ?? "Team"} planBadge={planBadge}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground">Your business identity and team.</p>
        </div>

        {upgrade && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                Compare plans and unlock more campaigns, team seats, and faster support.
              </p>
            </div>
            <a href="/plans" className="shrink-0 text-sm font-medium text-primary hover:underline">
              View plans
            </a>
          </div>
        )}

        {displayProfile && (
          <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-5">
            {displayProfile.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayProfile.logo_url}
                alt={displayProfile.company_name}
                className="h-16 w-16 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-2xl font-bold text-primary">
                <Building2 className="h-8 w-8" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-xl font-bold">{displayProfile.company_name}</h2>
                {displayProfile.kyb_status === "verified" && <Badge variant="success">Verified</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{displayProfile.bio || "No bio yet."}</p>
              {displayProfile.verified_domain && (
                <p className="mt-1 text-xs text-success">✓ Domain verified: {displayProfile.verified_domain}</p>
              )}
            </div>
          </div>
        )}

        {!isTeamMember && displayProfile && (
          <div className="rounded-lg border border-border bg-surface p-5">
            <h3 className="mb-3 font-heading text-sm font-semibold">Profile picture</h3>
            <AvatarUpload role="business" currentUrl={displayProfile.logo_url} name={displayProfile.company_name} />
          </div>
        )}

        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-heading text-sm font-semibold">Team members</h3>
          </div>
          <div className="mt-3">
            <TeamManagement
              initialMembers={(team ?? []).map((m) => ({
                business_id: m.business_id,
                user_id: m.user_id,
                role: m.role,
                invited_at: m.invited_at,
                joined_at: m.joined_at,
              }))}
              isOwner={!isTeamMember}
              pendingInvite={pendingInvite}
            />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
