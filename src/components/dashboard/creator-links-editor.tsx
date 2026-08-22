"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Twitter, Twitch, Loader2, Check } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeUrl } from "@/lib/creator-links";

/**
 * Edits the creator's self-described links (website, Twitter/X, Twitch).
 * The auto-synced platform links (TikTok/Instagram/YouTube) are managed via
 * connected accounts instead.
 */
export function CreatorLinksEditor({
  initial,
}: {
  initial: { website_url: string | null; twitter_url: string | null; twitch_url: string | null };
}) {
  const router = useRouter();
  const [website, setWebsite] = useState(initial.website_url ?? "");
  const [twitter, setTwitter] = useState(initial.twitter_url ?? "");
  const [twitch, setTwitch] = useState(initial.twitch_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const normalized = {
      website_url: normalizeUrl(website),
      twitter_url: normalizeUrl(twitter),
      twitch_url: normalizeUrl(twitch),
    };

    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("creator_profiles")
      .update(normalized)
      .eq("user_id", user.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="website-url" className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" /> Website
          </Label>
          <Input
            id="website-url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://your-site.com"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="twitter-url" className="flex items-center gap-1.5">
            <Twitter className="h-3.5 w-3.5 text-muted-foreground" /> Twitter / X
          </Label>
          <Input
            id="twitter-url"
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            placeholder="https://x.com/yourhandle"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="twitch-url" className="flex items-center gap-1.5">
            <Twitch className="h-3.5 w-3.5 text-muted-foreground" /> Twitch
          </Label>
          <Input
            id="twitch-url"
            value={twitch}
            onChange={(e) => setTwitch(e.target.value)}
            placeholder="https://twitch.tv/yourchannel"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          ) : (
            <>Save links</>
          )}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        TikTok, Instagram, and YouTube links come from your connected accounts — connect them above.
      </p>
    </div>
  );
}
