import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell, EmptyState } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Instagram, Youtube, Music2 } from "lucide-react";

const tierStyles: Record<string, string> = {
  micro: "bg-muted text-muted-foreground",
  mid: "bg-primary/10 text-primary",
  macro: "bg-warning/10 text-warning",
};

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Music2,
};

export default async function CreatorProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const { upgrade } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard");

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.onboarding_step !== "complete") redirect("/onboarding");

  const { data: socials } = await supabase
    .from("creator_social_accounts")
    .select("id, platform, handle, follower_count, verified_at")
    .eq("creator_id", user.id);

  const { data: subscription } = await supabase
    .from("creator_subscriptions")
    .select("plan_slug, status")
    .eq("creator_id", user.id)
    .single();

  const planBadge = subscription?.plan_slug
    ? subscription.plan_slug.replace("creator_", "").replace("_", " ").replace(/^\w/, (c: string) => c.toUpperCase())
    : "Free";

  return (
    <DashboardShell role="creator" userId={user.id} userName={profile.display_name} planBadge={planBadge}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground">Your creator identity and connected accounts.</p>
        </div>

        {upgrade && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm text-muted-foreground">
              Plan upgrades are part of the next phase. For now, you&apos;re on the Free plan —
              every feature you have now keeps working.
            </p>
          </div>
        )}

        <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-5">
          {profile.profile_picture_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profile_picture_url}
              alt={profile.display_name}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
              {profile.display_name?.charAt(0)?.toUpperCase() || "?"}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-bold">{profile.display_name}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tierStyles[profile.tier]}`}>
                {profile.tier} tier
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{profile.bio || "No bio yet."}</p>
            {profile.stripe_connect_ready && (
              <p className="mt-1 text-xs text-success">✓ Payout account connected</p>
            )}
          </div>
        </div>

        {profile.niches?.length > 0 && (
          <div className="rounded-lg border border-border bg-surface p-5">
            <h3 className="mb-2 font-heading text-sm font-semibold">Niches</h3>
            <div className="flex flex-wrap gap-1.5">
              {profile.niches.map((n: string) => (
                <span key={n} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{n}</span>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border bg-surface p-5">
          <h3 className="mb-3 font-heading text-sm font-semibold">Connected accounts</h3>
          {!socials || socials.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No social accounts connected yet. You&apos;ll connect them during onboarding or later from this page.
            </p>
          ) : (
            <div className="space-y-2">
              {socials.map((s) => {
                const Icon = platformIcons[s.platform] || Instagram;
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">@{s.handle}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{s.follower_count?.toLocaleString()} followers</span>
                      {s.verified_at && <Badge variant="success">Verified</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
