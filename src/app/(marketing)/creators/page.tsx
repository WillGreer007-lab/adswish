import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreatorGrid } from "@/components/marketing/creator-grid";

export const metadata: Metadata = {
  title: "Discover creators — Adswish",
  description:
    "Browse verified creators by tier, niche, and follower count. Connect with creators for affiliate campaigns on Adswish.",
  openGraph: {
    title: "Discover creators — Adswish",
    description:
      "Browse verified creators by tier, niche, and follower count. Connect with creators for affiliate campaigns on Adswish.",
    type: "website",
  },
};

export default async function CreatorsPage() {
  const supabase = await createSupabaseServerClient();

  // Every non-deleted creator with a completed profile is discoverable;
  // verified badges appear only where a connected account is verified.
  const { data: creators } = await supabase
    .from("creator_profiles")
    .select(
      "user_id, display_name, profile_picture_url, bio, tier, niches, average_rating, creator_social_accounts(platform, handle, follower_count, verified_at)",
    )
    .is("deleted_at", null)
    .order("average_rating", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Creator Marketplace</p>
        <h1 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">Discover creators</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Browse verified creators by tier and niche, then invite them to your campaign. Every profile shows
          real follower counts pulled straight from their connected accounts.
        </p>
      </div>

      <CreatorGrid creators={(creators ?? []) as never} />
    </div>
  );
}
