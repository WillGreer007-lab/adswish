import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Sparkles, CheckCircle2, Crown } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { AvatarUpload } from "@/components/dashboard/avatar-upload";
import { CreatorLinksEditor } from "@/components/dashboard/creator-links-editor";
import { DeleteAccountButton } from "@/components/dashboard/delete-account-button";
import { tierColor, tierLabel } from "@/lib/tier";

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
          <p className="text-sm text-muted-foreground">Your creator identity, links, and public profile.</p>
        </div>

        {upgrade && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                Compare plans and unlock more campaigns, faster payouts, and deeper analytics.
              </p>
            </div>
            <a href="/plans" className="shrink-0 text-sm font-medium text-primary hover:underline">
              View plans
            </a>
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
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tierColor(profile.tier)}`}>
                {tierLabel(profile.tier)}
              </span>
              {profile.verified_badge && (
                <Tooltip label="Verified — identity and paid plan confirmed by Adswish">
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                  </span>
                </Tooltip>
              )}
              {profile.gold_badge && (
                <Tooltip label="Gold — 1M+ followers on a verified platform">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
                    <Crown className="h-3.5 w-3.5" /> Gold
                  </span>
                </Tooltip>
              )}
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
          <h3 className="mb-3 font-heading text-sm font-semibold">Profile picture</h3>
          <AvatarUpload role="creator" currentUrl={profile.profile_picture_url} name={profile.display_name} />
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <h3 className="mb-3 font-heading text-sm font-semibold">Links</h3>
          <CreatorLinksEditor
            initial={{
              website_url: profile.website_url ?? null,
              twitter_url: profile.twitter_url ?? null,
              twitch_url: profile.twitch_url ?? null,
            }}
          />
        </div>

        <DeleteAccountButton />
      </div>
    </DashboardShell>
  );
}
