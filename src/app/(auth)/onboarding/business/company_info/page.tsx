"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Building2, Zap, Crown, FlaskConical, Mountain } from "lucide-react";
import { cn } from "@/lib/utils";

const AVATAR_OPTIONS = [
  { id: "gradient-blue", icon: Building2, color: "from-blue-500 to-indigo-600" },
  { id: "gradient-orange", icon: Zap, color: "from-orange-400 to-red-500" },
  { id: "gradient-purple", icon: Crown, color: "from-purple-500 to-pink-600" },
  { id: "gradient-green", icon: FlaskConical, color: "from-emerald-400 to-teal-600" },
  { id: "gradient-stone", icon: Mountain, color: "from-stone-500 to-gray-700" },
];

export default function BusinessCompanyInfo() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [bio, setBio] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("gradient-blue");

  useEffect(() => {
    async function loadData() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?redirect=/onboarding");
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("business_profiles")
        .select("company_name, bio, logo_url")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        setCompanyName(profile.company_name || "");
        setBio(profile.bio || "");
        if (profile.logo_url) setSelectedAvatar(profile.logo_url);
      }
    }
    loadData();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !companyName.trim()) return;
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();

    // Upsert so the profile row is created if it doesn't exist yet (e.g. the
    // user signed up before the schema was in place).
    const { error } = await supabase
      .from("business_profiles")
      .upsert({
        user_id: userId,
        company_name: companyName,
        bio,
        logo_url: selectedAvatar,
        account_status: "active",
        onboarding_step: "domain_verification",
      }, { onConflict: "user_id" });

    if (error) {
      setError(error.message || "Failed to save. Check your connection and try again.");
      setLoading(false);
      return;
    }

    router.push("/onboarding/business/domain_verification");
  }

  function handleSkip() {
    router.push("/dashboard");
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Set up your business profile</CardTitle>
        <p className="text-sm text-muted-foreground">
          Step 1 of 4 — Tell creators about your company.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar selection */}
          <div className="space-y-2">
            <Label>Company logo</Label>
            <div className="flex flex-wrap gap-3">
              {AVATAR_OPTIONS.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => setSelectedAvatar(avatar.id)}
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br transition-all",
                    avatar.color,
                    selectedAvatar === avatar.id
                      ? "ring-2 ring-primary ring-offset-2 scale-105"
                      : "opacity-60 hover:opacity-100"
                  )}
                >
                  <avatar.icon className="h-6 w-6 text-white" />
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              You can upload your own custom profile picture later inside Account Settings.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              placeholder="e.g. GlossyCo"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Company bio</Label>
            <textarea
              id="bio"
              className="flex w-full rounded-md border border-input bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="What does your company do?"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-right text-xs text-muted-foreground">{bio.length}/500</p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading || !companyName.trim()}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Continue"}
          </Button>

          <button type="button" onClick={handleSkip} className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
            Skip onboarding and go to dashboard
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
