import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Building2, Users2 } from "lucide-react";
import { AvatarUpload } from "@/components/dashboard/avatar-upload";

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

  if (!profile || profile.onboarding_step !== "complete") redirect("/onboarding");

  const { data: team } = await supabase
    .from("business_team_members")
    .select("id, email, role")
    .eq("business_id", user.id);

  const { data: subscription } = await supabase
    .from("business_subscriptions")
    .select("plan_slug, status")
    .eq("business_id", user.id)
    .single();

  const planBadge = subscription?.plan_slug
    ? subscription.plan_slug.replace("business_", "").replace("_", " ").replace(/^\w/, (c: string) => c.toUpperCase())
    : "Free";

  return (
    <DashboardShell role="business" userId={user.id} userName={profile.company_name} planBadge={planBadge}>
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

        <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-5">
          {profile.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.logo_url}
              alt={profile.company_name}
              className="h-16 w-16 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-2xl font-bold text-primary">
              <Building2 className="h-8 w-8" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-bold">{profile.company_name}</h2>
              {profile.kyb_status === "verified" && <Badge variant="success">Verified</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{profile.bio || "No bio yet."}</p>
            {profile.verified_domain && (
              <p className="mt-1 text-xs text-success">✓ Domain verified: {profile.verified_domain}</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <h3 className="mb-3 font-heading text-sm font-semibold">Profile picture</h3>
          <AvatarUpload role="business" currentUrl={profile.logo_url} name={profile.company_name} />
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-heading text-sm font-semibold">Team members</h3>
          </div>
          {!team || team.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No team members yet. You&apos;ll be able to invite teammates from this page.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {team.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm font-medium">{m.email}</span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs capitalize text-muted-foreground">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
