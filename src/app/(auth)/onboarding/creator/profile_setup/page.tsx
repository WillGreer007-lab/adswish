"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload } from "lucide-react";

const CREATOR_NICHES = [
  "Beauty", "Fashion", "Fitness", "Food", "Tech", "Gaming",
  "Travel", "Lifestyle", "Comedy", "Music", "Education", "DIY",
  "Parenting", "Pets", "Finance", "Health", "Art", "Photography",
  "Dance", "Sports", "Automotive", "Home Decor", "Sustainability",
  "Books", "Film", "Science", "Outdoor", "Cooking", "Skincare",
  "Haircare", "Jewelry", "Sneakers", "Streetwear", "Luxury",
  "Sustainable Fashion", "Minimalism", "Productivity", "Startups",
  "Real Estate", "Investing", "Crypto", "AI", "Podcasts",
  "Photography Gear", "Mobile Apps", "SaaS", "Smart Home",
  "Plants", "Garden", "Interior Design", "Renovation",
];

export default function CreatorProfileSetup() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [profilePicture, setProfilePicture] = useState<File | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?redirect=/onboarding");
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("creator_profiles")
        .select("display_name, bio, niches, profile_picture_url")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        setDisplayName(profile.display_name || "");
        setBio(profile.bio || "");
        setSelectedNiches(profile.niches || []);
      }
    }
    loadProfile();
  }, [router]);

  function toggleNiche(niche: string) {
    setSelectedNiches((prev) => {
      if (prev.includes(niche)) return prev.filter((n) => n !== niche);
      if (prev.length >= 5) return prev;
      return [...prev, niche];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (selectedNiches.length === 0) {
      alert("Please select at least 1 niche.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    let profilePictureUrl: string | null = null;
    if (profilePicture) {
      const ext = profilePicture.name.split(".").pop();
      const fileName = `${userId}/profile.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("creator-assets")
        .upload(fileName, profilePicture, { upsert: true });
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from("creator-assets")
          .getPublicUrl(fileName);
        profilePictureUrl = publicUrl;
      }
    }

    // Upsert so the profile row is created if it doesn't exist yet (e.g. the
    // user signed up before the schema was in place).
    const { error } = await supabase
      .from("creator_profiles")
      .upsert({
        user_id: userId,
        display_name: displayName,
        bio,
        niches: selectedNiches,
        profile_picture_url: profilePictureUrl,
        account_status: "active",
        onboarding_step: "connect_social",
      }, { onConflict: "user_id" });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    router.push("/onboarding/creator/connect_social");
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Set up your creator profile</CardTitle>
        <p className="text-sm text-muted-foreground">
          Step 1 of 4 — Tell businesses who you are.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profilePicture">Profile photo</Label>
            <div className="flex items-center gap-3">
              <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-border hover:border-primary">
                {profilePicture ? (
                  <img
                    src={URL.createObjectURL(profilePicture)}
                    alt="Profile"
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setProfilePicture(e.target.files?.[0] || null)}
                />
              </label>
              <span className="text-xs text-muted-foreground">PNG or JPG, max 5MB</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              placeholder="e.g. Sarah Creates"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              className="flex w-full rounded-md border border-input bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Tell businesses about your content style and audience..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-right text-xs text-muted-foreground">{bio.length}/500</p>
          </div>

          <div className="space-y-2">
            <Label>Niches (select up to 5)</Label>
            <div className="flex flex-wrap gap-2">
              {CREATOR_NICHES.map((niche) => (
                <button
                  key={niche}
                  type="button"
                  onClick={() => toggleNiche(niche)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selectedNiches.includes(niche)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {niche}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{selectedNiches.length}/5 selected</p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
