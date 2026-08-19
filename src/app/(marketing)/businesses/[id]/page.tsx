import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, CheckCircle2, Building2 } from "lucide-react";
import { ConnectButton } from "@/components/dashboard/connect-button";

const planConfig: Record<string, { label: string; color: string }> = {
  business_free: { label: "Free", color: "bg-muted text-muted-foreground" },
  business_growth: { label: "Growth", color: "bg-primary/10 text-primary" },
  business_enterprise: { label: "Enterprise", color: "bg-payment-hybrid/10 text-payment-hybrid" },
};

export default async function BusinessProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", id)
    .is("deleted_at", null)
    .single();

  if (!profile) notFound();

  const { data: subscription } = await supabase
    .from("business_subscriptions")
    .select("plan_slug")
    .eq("business_id", id)
    .eq("status", "active")
    .single();

  const planSlug = subscription?.plan_slug || "business_free";
  const plan = planConfig[planSlug] || planConfig.business_free;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
        <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border-2 border-border bg-muted sm:mb-0 sm:mr-6">
          {profile.logo_url ? (
            <img src={profile.logo_url} alt={profile.company_name} className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold">{profile.company_name}</h1>
            {profile.verified_domain && (
              <CheckCircle2 className="h-5 w-5 text-success" />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{profile.bio}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${plan.color}`}>
              {plan.label} Plan
            </span>
            {profile.verified_domain && (
              <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                {profile.verified_domain}
              </span>
            )}
            {profile.average_rating > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Star className="h-3 w-3 fill-warning text-warning" />
                {profile.average_rating.toFixed(1)}
              </span>
            )}
          </div>
          <div className="mt-4">
            <ConnectButton targetUserId={id} />
          </div>
        </div>
      </div>

      {/* Campaign history */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">Campaign history</h2>
        <div className="flex min-h-20 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
          <p className="text-sm text-muted-foreground">No campaigns yet</p>
        </div>
      </div>
    </div>
  );
}
