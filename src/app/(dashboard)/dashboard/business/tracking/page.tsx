import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { TrackingMethodToggle, type TrackingMethod } from "@/components/dashboard/tracking-method-toggle";
import { Code2, Puzzle } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tracking — Adswish" };

export default async function BusinessTrackingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard/business/tracking");

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("company_name, verified_domain, onboarding_step, tracking_method")
    .eq("user_id", user.id)
    .single();

  const method: TrackingMethod = profile?.tracking_method === "extension" ? "extension" : "script";

  if (!profile || profile.onboarding_step !== "complete") redirect("/onboarding");

  // Resolve the app's own origin (the API base the pixel/extension should hit).
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

  const businessId = user.id;

  const scriptSnippet = `<script>
  (function (w, d, id) {
    var js = d.createElement("script");
    js.async = true;
    js.src = "${appUrl}/pixel.js?id=" + encodeURIComponent(id);
    js.onload = function () {
      if (w.adswish) w.adswish.init({ consent: true, attributionDays: 30 });
    };
    d.head.appendChild(js);
  })(window, document, "${businessId}");
</script>`;

  return (
    <DashboardShell role="business" userId={user.id} userName={profile.company_name}>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Tracking</h1>
          <p className="text-sm text-muted-foreground">
            Attribute conversions from your creator&apos;s links. Choose your method —
            the Chrome extension needs no site code; the script tracks every visitor.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-1 font-heading text-sm font-semibold">Your tracking method</h2>
          <TrackingMethodToggle current={method} />
        </div>

        {/* Option A: pixel script */}
        <section className={cn("rounded-lg border bg-surface p-5", method === "script" ? "border-primary/50" : "border-border")}>
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-lg font-semibold">Option A — Pixel script</h2>
            <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              Tracks all visitors
            </span>
            {method === "script" && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                Your choice
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste this into the <code className="rounded bg-muted px-1">&lt;head&gt;</code> of
            every page on <span className="font-medium text-foreground">{profile.verified_domain || "your site"}</span>.
            It runs in your visitors&apos; browsers and attributes everyone.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-black p-4 text-xs leading-relaxed text-[#9cdcfe]">
            <code>{scriptSnippet}</code>
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">
            On your checkout confirmation page, fire a conversion with{" "}
            <code className="rounded bg-muted px-1">adswish.track({"{ orderId: \"ORDER_123\", amount: 99.99 }"})</code>.
          </p>
        </section>

        {/* Option B: Chrome extension */}
        <section className={cn("rounded-lg border bg-surface p-5", method === "extension" ? "border-primary/50" : "border-border")}>
          <div className="flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-lg font-semibold">Option B — Chrome extension</h2>
            <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              No site code
            </span>
            {method === "extension" && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                Your choice
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Install the <span className="font-medium text-foreground">Adswish Tracker</span>{" "}
            extension instead of editing your site. It captures the attribution token and keeps
            your campaigns&apos; pixel alive — ideal for testing and small sites.{" "}
            <span className="text-muted-foreground/70">(Only tracks the browser it&apos;s installed on.)</span>
          </p>

          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Open <code className="rounded bg-muted px-1">chrome://extensions</code> and enable <strong>Developer mode</strong>.</li>
            <li>Click <strong>Load unpacked</strong> and select the project&apos;s <code className="rounded bg-muted px-1">chrome-extension/</code> folder.</li>
            <li>Open the extension&apos;s <strong>Options</strong> and enter:</li>
          </ol>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Adswish API base URL</p>
              <p className="mt-1 font-mono text-sm">{appUrl}</p>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Business ID</p>
              <p className="mt-1 break-all font-mono text-sm">{businessId}</p>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Then visit any <code className="rounded bg-muted px-1">/t/&#123;slug&#125;</code> link
            and click the extension icon to test a heartbeat or conversion. Full instructions live
            in <code className="rounded bg-muted px-1">chrome-extension/README.md</code>.
          </p>
        </section>
      </div>
    </DashboardShell>
  );
}
