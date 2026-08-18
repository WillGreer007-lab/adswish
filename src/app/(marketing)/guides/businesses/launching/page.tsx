import Link from "next/link";
import {
  GuidePage,
  GuideSection,
  GuideList,
  GuideCode,
  GuideNote,
} from "@/components/guides/guide-page";

export const metadata = {
  title: "Launching your first campaign — Business guide",
  description:
    "From campaign creation to pixel installation to your first attributed sale on Adswish.",
};

export default function BusinessLaunchingGuide() {
  return (
    <GuidePage eyebrow="For Businesses" title="Launching your first campaign" readTime="8 min" updated="Aug 2026">
      <GuideSection step={1} title="Create your business account">
        <p>
          Sign up at <Link href="/signup">/signup</Link> as a{" "}
          <strong>Business</strong> and finish onboarding: company info,
          KYB verification, and (recommended) verifying your domain — the
          verified domain is what your tracking links will point at.
        </p>
      </GuideSection>

      <GuideSection step={2} title="Launch a campaign">
        <GuideList
          items={[
            <>
              <strong>Campaign type:</strong> Fixed fee (flat payment per
              deliverable), Affiliate (pay on attributed sales), or Hybrid
              (small fixed fee + affiliate).
            </>,
            "Deliverables & deadlines: set how many deliverables and per-slot deadlines you expect.",
            "Budget & visibility: set the budget cap and choose who can see the campaign in Discover.",
            "Draft first, then launch — nothing is public until you launch it. (Free tier: 3 campaigns/month.)",
          ]}
        />
      </GuideSection>

      <GuideSection step={3} title="Pick your creators">
        <p>
          Applications land in <strong>Dashboard → Applicants</strong>. Review
          profiles, ratings, and cover notes, then approve (individually or in
          bulk). Approved creators get locked-in deliverable slots and their own
          tracking link — generated automatically the moment you approve them.
        </p>
        <GuideNote>
          Your tracking links only go live when the campaign is active and
          not paused. A “new applications only” pause keeps existing links
          working; a full pause turns them off.
        </GuideNote>
      </GuideSection>

      <GuideSection step={4} title="Install tracking — 10 minutes">
        <p>
          Open <strong>Settings → Tracking</strong> and pick one method:
        </p>
        <GuideList
          items={[
            <>
              <strong>Option A — Pixel script (tracks every visitor):</strong>{" "}
              copy the snippet and paste it into the{" "}
              <code className="rounded bg-muted px-1">&lt;head&gt;</code> of
              every page of your site.
            </>,
            <>
              <strong>Option B — Chrome extension (no site code):</strong>{" "}
              install it, point it at your site domain, and it captures the
              attribution token, sends heartbeats, and can auto-detect orders on
              your confirmation page.
            </>,
            <>
              <strong>Engineering:</strong> GTM container template and the S2S
              conversion API are covered in the{" "}
              <Link href="/guides/engineering/pixel-integration" className="text-primary underline">
                Pixel integration guide
              </Link>
              .
            </>,
          ]}
        />
        <GuideCode label="Direct embed (Option A)">
{`<script>
  (function (w, d, id) {
    var js = d.createElement("script");
    js.async = true;
    js.src = "https://<APP_URL>/pixel.js?id=" + encodeURIComponent(id);
    js.onload = function () {
      if (w.adswish) w.adswish.init({ consent: true, attributionDays: 30 });
    };
    d.head.appendChild(js);
  })(window, document, "<BUSINESS_ID>");
</script>`}
        </GuideCode>
      </GuideSection>

      <GuideSection step={5} title="Your first attributed sale">
        <GuideList
          items={[
            "A customer clicks a creator's /t/{slug} link → they land on your site with an attribution token.",
            "Your pixel stores the token and reports the order to the conversion webhook (or your backend does it server-to-server).",
            "The order amount is charged to the card you saved under Payments — 90% is held for the creator, 10% is the platform fee.",
            "After the 7-day hold the creator's 90% is released, and they get paid on the weekly payout schedule.",
          ]}
        />
        <GuideNote>
          The pixel heartbeat also keeps your campaign marked active — if your
          pixel goes silent for over 12 hours the campaign gets paused to stop
          attribution drift. A fresh heartbeat restores it.
        </GuideNote>
      </GuideSection>

      <GuideSection step={6} title="Manage deliverables, disputes & ratings">
        <p>
          Review submitted deliverables in the campaign view — approve, or
          reject (partial refunds are split pro-rata). If a creator or you raise
          an SLA dispute, it auto-resolves after 72 hours; unresolved disputes
          cancel the campaign and count a strike against the at-fault side (3
          strikes = ban). Rate creators two-sided and keep your own reputation
          high — it shows on your public business page.
        </p>
      </GuideSection>
    </GuidePage>
  );
}
