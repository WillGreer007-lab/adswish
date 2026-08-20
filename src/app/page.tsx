"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Lock,
  BarChart3,
  Percent,
  ShieldAlert,
  Star,
  MessageSquare,
  Zap,
  Search,
  TrendingUp,
  Video,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  Megaphone,
  Eye,
  Clock,
  Tag,
  Bell,
  Compass,
  ChevronDown,
  Download,
  Instagram,
  Youtube,
  Music2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CookieConsentBanner } from "@/components/shared/cookie-consent-banner";
import { AdswishLogo } from "@/components/shared/logo";
import { IntegrationLogo, type LogoName } from "@/components/dashboard/integration-logos";

const guides = [
  { eyebrow: "For Creators", title: "Getting your first campaign", desc: "How to set up your profile, connect socials, and start earning.", readTime: "5 min", href: "/guides/creators/getting-started" },
  { eyebrow: "For Businesses", title: "Launching your first campaign", desc: "From campaign creation to pixel installation to first sale.", readTime: "8 min", href: "/guides/businesses/launching" },
  { eyebrow: "Engineering", title: "Pixel integration guide", desc: "Install the tracking pixel with GTM, Shopify, or direct embed.", readTime: "12 min", href: "/guides/engineering/pixel-integration" },
  { eyebrow: "For Businesses", title: "Amplify with Google Ads", desc: "Connect Google Ads, get the developer token, and launch your first amplified campaign.", readTime: "10 min", href: "/guides/businesses/google-ads" },
];

const platformIntegrations: { name: string; logo: LogoName }[] = [
  { name: "Google Ads", logo: "google_ads" },
  { name: "Meta Ads", logo: "meta_ads" },
  { name: "TikTok Ads", logo: "tiktok_ads" },
  { name: "YouTube Ads", logo: "youtube_ads" },
  { name: "Instagram Ads", logo: "instagram_ads" },
  { name: "X Ads", logo: "x_ads" },
  { name: "LinkedIn Ads", logo: "linkedin_ads" },
  { name: "Pinterest Ads", logo: "pinterest_ads" },
  { name: "Snapchat Ads", logo: "snapchat_ads" },
  { name: "Stripe", logo: "stripe" },
  { name: "Resend", logo: "resend" },
  { name: "Supabase", logo: "supabase" },
  { name: "Upstash", logo: "upstash" },
  { name: "Sightengine", logo: "sightengine" },
];

const deepDives = [
  {
    name: "Discover",
    tag: "NEW",
    bullets: [
      { title: "Filter by real data", desc: "Set min and max for commission, attribution window, rating, and niche to find campaigns that match your exact criteria." },
      { title: "Save filter presets", desc: "Save your favorite filter combinations as reusable presets. Pro users get unlimited presets." },
      { title: "Apply in one click", desc: "Pre-filled application with your profile data and tier badge. Add an optional 280-character cover note." },
    ],
    mockup: "discover",
  },
  {
    name: "Lock & Key",
    tag: null,
    bullets: [
      { title: "Sequential deliverables", desc: "Creators get a locked grid — Box 1, Box 2, Box 3. Each slot unlocks only after the business approves the previous one." },
      { title: "Hashtag verification", desc: "Each deliverable needs a unique hashtag. We verify via platform oEmbed API. Never scrape TikTok/Instagram pages." },
      { title: "24-hour grace period", desc: "Missed deadlines trigger a 24-hour grace period with escalating reminders before auto-removal." },
    ],
    mockup: "lockkey",
  },
  {
    name: "Escrow",
    tag: null,
    bullets: [
      { title: "Nobody has to go first", desc: "Funds move to Stripe Connect hold the moment a business approves a creator. Both sides protected." },
      { title: "7-day auto-release", desc: "If nothing is disputed, funds release to the creator automatically after 7 days. Pro creators get instant release." },
      { title: "Partial refunds", desc: "If a creator delivers 2 of 3, the business pays for what was delivered. Pro-rata, not all-or-nothing." },
    ],
    mockup: "escrow",
  },
  {
    name: "Attribution",
    tag: "HOT",
    bullets: [
      { title: "One line of code", desc: "Drop the pixel script on your site. Edge-redirected links survive most ad blockers." },
      { title: "First-party cookie", desc: "Cookie scoped to the attribution window (1-30 days). Last-click wins. JWT verified at the edge." },
      { title: "Server-to-Server fallback", desc: "GDPR consent blocking the cookie? The business backend POSTs conversions server-side. Attribution survives." },
    ],
    mockup: "attribution",
  },
];

const perks = [
  { icon: Lock, title: "Nobody has to go first", desc: "Escrow holds funds until deliverables are approved. Both sides protected." },
  { icon: Zap, title: "Every sale, tracked", desc: "Edge-redirected links with first-party cookies. Attribution that survives ad blockers." },
  { icon: Percent, title: "Creators keep 90%", desc: "One flat 10% platform fee. No hidden cuts. The number you see is the number you get." },
  { icon: ShieldAlert, title: "SLA Guard", desc: "72-hour dispute resolution. Auto-drops for broken campaigns. Three-strike accountability." },
  { icon: Star, title: "Review Engine", desc: "Two-sided ratings with right-to-reply. Reputation reflects bad outcomes too." },
  { icon: MessageSquare, title: "Creator Chat", desc: "Real-time messaging with PII filtering. Negotiate terms without leaving the platform." },
];

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".fade-in-up").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function MockupDiscover() {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
      <div className="border-b border-border bg-muted/50 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-destructive/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-warning/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-success/30" />
        </div>
        <span className="ml-2 text-xs text-muted-foreground">adswish.com/discover</span>
      </div>
      <div className="p-5">
        <div className="flex gap-2 mb-4">
          <div className="flex-1 h-9 rounded-md bg-muted shimmer" />
          <div className="h-9 w-24 rounded-md bg-primary/10" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map((i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="h-16 rounded shimmer mb-2" />
              <div className="h-3 w-3/4 rounded shimmer mb-1.5" />
              <div className="h-2 w-1/2 rounded shimmer" />
              <div className="mt-2 flex items-center justify-between">
                <Badge variant="paymentAffiliate" className="text-[9px]">Affiliate</Badge>
                <span className="font-mono text-xs font-bold">—</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockupLockKey() {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
      <div className="border-b border-border bg-muted/50 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-destructive/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-warning/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-success/30" />
        </div>
        <span className="ml-2 text-xs text-muted-foreground">Deliverable Track</span>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          {[1,2,3].map((i) => (
            <div key={i} className="flex-1">
              <div className={`h-2 rounded-full ${i === 1 ? "bg-success" : i === 2 ? "bg-primary" : "bg-muted"}`} />
              <p className="mt-1 text-[10px] text-center text-muted-foreground">Box {i}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-xs font-medium">#AdswishBrandAV1</span>
            </div>
            <Badge variant="success" className="text-[9px]">Approved</Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-xs font-medium">#AdswishBrandAV2</span>
            </div>
            <Badge variant="default" className="text-[9px]">In Review</Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-3 opacity-50">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">#AdswishBrandAV3</span>
            </div>
            <span className="text-[9px] text-muted-foreground">Locked</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockupEscrow() {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
      <div className="border-b border-border bg-muted/50 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-destructive/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-warning/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-success/30" />
        </div>
        <span className="ml-2 text-xs text-muted-foreground">Financial Timeline</span>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-payment-fixed/5 border border-payment-fixed/20 p-3 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Pending</p>
            <p className="font-mono text-lg font-bold text-payment-fixed">—</p>
          </div>
          <div className="rounded-lg bg-success/5 border border-success/20 p-3 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Available</p>
            <p className="font-mono text-lg font-bold text-success">—</p>
          </div>
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-center">
            <p className="text-[10px] uppercase text-muted-foreground">Total</p>
            <p className="font-mono text-lg font-bold text-primary">—</p>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { label: "Hold → Creator A", amount: "—", status: "Pending", color: "text-payment-fixed" },
            { label: "Released → Creator B", amount: "—", status: "Released", color: "text-success" },
            { label: "Hold → Creator C", amount: "—", status: "Pending", color: "text-payment-fixed" },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border border-border p-2.5">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-xs font-bold ${item.color}`}>{item.amount}</span>
                <span className={`text-[9px] ${item.color}`}>{item.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockupAttribution() {
  return (
    <div className="rounded-lg border border-border bg-[#1e1e1e] shadow-sm overflow-hidden">
      <div className="border-b border-white/10 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-[#ff5f56]" />
          <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <div className="h-3 w-3 rounded-full bg-[#27c93f]" />
        </div>
        <span className="ml-2 text-xs text-white/40">pixel.html</span>
      </div>
      <pre className="overflow-x-auto p-4 text-sm font-mono leading-relaxed">
        <code className="text-white/90">
          <span className="text-[#569cd6]">&lt;script</span>{" "}
          <span className="text-[#9cdcfe]">src</span>=<span className="text-[#ce9178]">&quot;https://adswish.com/pixel.js?id=BUS_123&quot;</span>{" "}
          <span className="text-[#9cdcfe]">async</span><span className="text-[#569cd6]">&gt;&lt;/script&gt;</span>
          {"\n\n"}
          <span className="text-[#6a9955]">{"// Track a conversion on checkout"}</span>
          {"\n"}
          <span className="text-[#9cdcfe]">adswish</span>.<span className="text-[#dcdcaa]">track</span>(<span className="text-[#ce9178]">&apos;purchase&apos;</span>, <span className="text-[#b5cea8]">{`{`}</span>
          {"\n  "}
          <span className="text-[#9cdcfe]">orderId</span>: <span className="text-[#ce9178]">&quot;ORD-4821&quot;</span>,{"\n  "}
          <span className="text-[#9cdcfe]">amount</span>: <span className="text-[#b5cea8]">49.99</span>,{"\n"}
          <span className="text-[#b5cea8]">{`})`}</span>;{"\n\n"}
          <span className="text-[#6a9955]">{"// > Attribution recorded → payout queued"}</span>
        </code>
      </pre>
    </div>
  );
}

export default function LandingPage() {
  useScrollReveal();
  const perksRef = useRef<HTMLDivElement>(null);
  const [activeCampaigns, setActiveCampaigns] = useState(0);

  // Only surface the live-campaigns section once the platform has real scale
  // (100+ active campaigns) so the homepage never shows fabricated examples.
  useEffect(() => {
    fetch("/api/v1/campaigns/count")
      .then((r) => r.json())
      .then((d) => setActiveCampaigns(d.active ?? 0))
      .catch(() => {});
  }, []);

  const scrollPerks = (dir: "left" | "right") => {
    if (!perksRef.current) return;
    const amount = 340;
    perksRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <AdswishLogo wordmark={false} className="h-8 w-8 text-primary" />
            <span className="font-heading text-xl font-bold tracking-tight text-foreground">adswish</span>
          </Link>
          <div className="hidden items-center gap-8 lg:flex">
            <Link href="/creators" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Creators</Link>
            <Link href="/businesses" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Businesses</Link>
            <Link href="/plans" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Plans</Link>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">How it works</a>
            <a href="#perks" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Perks</a>
            <a href="#guides" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Guides</a>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/signup">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative border-b border-border bg-surface overflow-hidden">
        <div className="mx-auto max-w-5xl px-4 pt-16 pb-16 text-center sm:px-6 lg:px-8 lg:pt-24 lg:pb-24">
          {/* Status pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1.5 pl-1.5 pr-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <AdswishLogo wordmark={false} className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium text-foreground/80">Adswish v3 is now live</span>
          </div>

          {/* Headline */}
          <h1 className="mt-6 font-heading text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            <span className="text-foreground">A marketplace for</span>{" "}
            <span className="text-primary">business</span>{" "}
            <span className="text-foreground">and</span>{" "}
            <span className="text-primary">creators</span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mt-6 max-w-2xl text-lg text-foreground/80 sm:text-xl">
            The two-sided marketplace connecting businesses with content creators for affiliate, fixed-fee, and hybrid campaigns — with escrowed payouts and tracking built in.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full px-8 font-semibold">
              <Link href="/signup?role=business">Start a Campaign</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-8 font-semibold">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>

        </div>
      </section>

      {/* Live campaigns — only shown once the platform has 100+ active campaigns */}
      {activeCampaigns >= 100 && (
        <section id="live-campaigns" className="border-b border-border bg-muted/50 py-16">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">Live campaigns</h2>
            <p className="mt-3 text-muted-foreground">See what businesses are running right now.</p>
            <div className="mt-8 flex justify-center">
              <Button asChild size="lg" className="rounded-full px-8">
                <Link href="/creators">Browse live campaigns</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Feature deep-dives — alternating like dropship.io */}
      {deepDives.map((feature, idx) => (
        <section key={feature.name} className={`border-b border-border py-16 ${idx % 2 === 1 ? "bg-muted/30" : ""}`}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div className={`fade-in-up ${idx % 2 === 1 ? "lg:order-2" : ""}`}>
                {feature.mockup === "discover" && <MockupDiscover />}
                {feature.mockup === "lockkey" && <MockupLockKey />}
                {feature.mockup === "escrow" && <MockupEscrow />}
                {feature.mockup === "attribution" && <MockupAttribution />}
              </div>
              <div className={`fade-in-up ${idx % 2 === 1 ? "lg:order-1" : ""}`}>
                {feature.tag && (
                  <Badge variant={feature.tag === "HOT" ? "destructive" : "default"} className="mb-3 text-[10px]">{feature.tag}</Badge>
                )}
                <h3 className="font-heading text-2xl font-bold sm:text-3xl">{feature.name}</h3>
                <ul className="mt-6 space-y-4">
                  {feature.bullets.map((b) => (
                    <li key={b.title}>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                        <div>
                          <p className="font-medium">{b.title}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">{b.desc}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* Integrations — powered by the tools you already use */}
      <section id="integrations" className="border-b border-border bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="fade-in-up text-center">
            <Badge variant="outline" className="mb-3">Integrations</Badge>
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">
              Built on the tools you already use
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Every integration in the Adswish ecosystem — connect, amplify, and track
              across the platforms your audience lives on.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {platformIntegrations.map((item, i) => (
              <div
                key={item.name}
                className="fade-in-up flex flex-col items-center rounded-xl border border-border bg-surface p-5 card-lift"
                style={{ transitionDelay: `${i * 40}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <IntegrationLogo name={item.logo} className="h-7 w-7" />
                </div>
                <p className="mt-3 text-center text-sm font-medium">{item.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chrome extension — install in 3 clicks */}
      <section id="extension" className="border-b border-border py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="fade-in-up mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="mb-3">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-primary"></span>
              Adswish Tracker — Chrome extension
            </Badge>
            <h3 className="font-heading text-2xl font-bold sm:text-3xl">
              Attribution without touching your site.
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No script tags, no GTM, no developer. Install the extension, connect your
              business, and conversions get attributed automatically.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { step: "1", title: "Install the extension", desc: "Load it from the Chrome Web Store (or unpacked from chrome://extensions in dev)." },
              { step: "2", title: "Connect your business", desc: "Paste your API URL and Business ID from Settings → Tracking into the extension options." },
              { step: "3", title: "Track automatically", desc: "It captures your /t/ links, heartbeats your pixel, and fires conversions — zero site code." },
            ].map((s, i) => (
              <div key={s.step} className="fade-in-up rounded-lg border border-border bg-surface p-6 card-lift" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-heading text-lg font-bold text-primary">
                  {s.step}
                </div>
                <h4 className="mt-4 font-heading text-base font-semibold">{s.title}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="sm" className="btn-slide" onClick={() => window.open("https://chrome.google.com/webstore", "_blank")}>
              Get it on the Chrome Web Store
            </Button>
            <Link href="/dashboard/business/tracking">
              <Button size="sm" variant="outline" className="card-lift">
                Settings → Tracking
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-b border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="fade-in-up">
            <h2 className="text-center font-heading text-3xl font-bold sm:text-4xl">How it works</h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-4">
            {[
              { step: "01", title: "Post a campaign", desc: "Set your terms — fixed, affiliate, or hybrid" },
              { step: "02", title: "Creators apply", desc: "Filtered by tier, niche, and rating" },
              { step: "03", title: "Approve each video", desc: "Lock-and-key deliverables, one slot at a time" },
              { step: "04", title: "Sales track, creators get paid", desc: "Escrow releases automatically after 7 days" },
            ].map((item, i) => (
              <div key={item.step} className="fade-in-up text-center" style={{ transitionDelay: `${i * 100}ms` }}>
                <p className="font-mono text-3xl font-bold text-primary">{item.step}</p>
                <h3 className="mt-3 font-heading text-lg font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Perks carousel with arrows */}
      <section id="perks" className="border-b border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="fade-in-up flex items-center justify-between">
            <div>
              <h2 className="font-heading text-3xl font-bold sm:text-4xl">Perks of Adswish</h2>
              <p className="mt-3 text-muted-foreground">Built for creators and businesses with mutual accountability built in.</p>
            </div>
            <div className="hidden gap-2 md:flex">
              <button onClick={() => scrollPerks("left")} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface hover:bg-muted transition-colors" aria-label="Previous">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button onClick={() => scrollPerks("right")} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface hover:bg-muted transition-colors" aria-label="Next">
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div ref={perksRef} className="mt-12 flex gap-6 overflow-x-auto no-scrollbar snap-carousel pb-2">
            {perks.map((perk, i) => (
              <div key={perk.title} className="fade-in-up min-w-[300px] flex-shrink-0 rounded-lg border border-border bg-surface p-6 card-lift" style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full glass-badge">
                  <perk.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading text-lg font-semibold">{perk.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{perk.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guides */}
      <section id="guides" className="border-b border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="fade-in-up">
            <h2 className="text-center font-heading text-3xl font-bold sm:text-4xl">Guides to get you going</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {guides.map((guide, i) => (
              <div key={guide.title} className="fade-in-up rounded-lg border border-border bg-surface overflow-hidden card-lift" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="h-32 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg glass-badge">
                    <ArrowRight className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-primary">{guide.eyebrow}</p>
                    <span className="text-xs text-muted-foreground">{guide.readTime}</span>
                  </div>
                  <h3 className="mt-1 font-heading text-lg font-semibold">{guide.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{guide.desc}</p>
                  <a href={guide.href} className="mt-3 inline-flex items-center text-sm font-medium text-primary hover:underline">
                    Read guide <ArrowRight className="ml-1 h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dark CTA */}
      <section className="relative overflow-hidden bg-foreground py-24">
        <div className="absolute inset-0 radial-glow" />
        <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-heading text-3xl font-bold text-background sm:text-4xl">Ready to begin?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-background/60">
            Start your free account and launch your first campaign today. No upfront cost. Creators keep 90%.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="btn-slide">
              <Link href="/signup?role=business">Start a Campaign</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/20 bg-transparent text-background hover:bg-white/10 hover:text-background">
              <Link href="/signup?role=creator">Join as a Creator</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-5">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2">
                <AdswishLogo className="h-8 w-auto text-primary" />
                <span className="font-heading text-xl font-bold">adswish</span>
              </div>
              <p className="mt-3 max-w-xs text-sm text-muted-foreground">The ad marketplace for businesses &amp; creators.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Product</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a></li>
                <li><a href="#perks" className="hover:text-foreground transition-colors">Perks</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Creators</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link href="/creators" className="hover:text-foreground transition-colors">Marketplace</Link></li>
                <li><Link href="/signup?role=creator" className="hover:text-foreground transition-colors">Join</Link></li>
                <li><a href="#guides" className="hover:text-foreground transition-colors">Guides</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Legal</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link href="/legal/terms" className="hover:text-foreground transition-colors">Terms</Link></li>
                <li><Link href="/legal/privacy" className="hover:text-foreground transition-colors">Privacy</Link></li>
                <li><Link href="/legal/subprocessors" className="hover:text-foreground transition-colors">Subprocessors</Link></li>
                <li><Link href="/legal/changelog" className="hover:text-foreground transition-colors">Changelog</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">&copy; 2026 Adswish. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <CookieConsentBanner />
    </div>
  );
}
