import Link from "next/link";
import {
  GuidePage,
  GuideSection,
  GuideList,
  GuideNote,
} from "@/components/guides/guide-page";

export const metadata = {
  title: "Getting your first campaign — Creator guide",
  description:
    "Set up your profile, connect socials, apply to campaigns, and start earning on Adswish.",
};

export default function CreatorGettingStartedGuide() {
  return (
    <GuidePage eyebrow="For Creators" title="Getting your first campaign" readTime="5 min" updated="Aug 2026">
      <GuideSection step={1} title="Create your creator account">
        <p>
          Sign up at <Link href="/signup">/signup</Link> and choose the{" "}
          <strong>Creator</strong> role — email/password or “Continue with
          Google” both work. Then finish the onboarding wizard: your profile, a
          quick tier check, plan selection, and finally Stripe payouts.
        </p>
        <GuideNote>
          You can browse and apply before payouts are set up, but you won&apos;t
          actually get paid until (1) your Stripe Connect onboarding is complete
          and (2) your tax form (W-9 / W-8BEN) is approved. Both live under{" "}
          <strong>Dashboard → Payouts</strong>.
        </GuideNote>
      </GuideSection>

      <GuideSection step={2} title="Make your profile work for you">
        <GuideList
          items={[
            <>
              <strong>Profile:</strong> a clear display name, a short bio, your
              niche, and a sample of past work — businesses review these before
              approving anyone.
            </>,
            <>
              <strong>Connect socials:</strong> link Google/YouTube to verify
              your subscriber count (that determines your tier: Micro
              1k–9.9k, Mid 10k–99k, Macro 100k+). Instagram and TikTok connects
              are optional extras for social proof.
            </>,
            <>
              <strong>Reputation:</strong> reviews are two-sided and you have a
              right to reply. A strong rating is the fastest way to get
              approved.
            </>,
          ]}
        />
      </GuideSection>

      <GuideSection step={3} title="Discover and apply">
        <p>
          Open <strong>Dashboard → Discover</strong> and filter by niche, budget,
          and campaign type (Fixed fee, Affiliate, or Hybrid). Each campaign
          shows what the business wants, how many deliverables, and the budget.
        </p>
        <GuideList
          items={[
            "Apply with a short cover note — businesses see it in their Applicants queue.",
            "Free tier lets you apply to 20 campaigns per month; paid plans raise that.",
            "You can apply to the same campaign once — the platform enforces it.",
          ]}
        />
      </GuideSection>

      <GuideSection step={4} title="Deliver on schedule">
        <p>
          When the business approves you, your deliverables appear in{" "}
          <strong>Dashboard → My Campaigns</strong> with individual deadlines.
          Each one has a 24-hour grace period before it counts as missed — after
          that the deliverable is kicked and your completion record takes a hit.
        </p>
        <p>
          Fixed-fee campaigns pay on approval. Affiliate/Hybrid campaigns give
          you a unique tracking link: you promote it, and every attributed sale
          earns you 90% of the attributed revenue.
        </p>
      </GuideSection>

      <GuideSection step={5} title="Getting paid">
        <GuideList
          items={[
            "Every conversion enters a 7-day hold (protects against refunds/chargebacks).",
            "After the hold, revenue releases to your balance.",
            "Weekly payouts pay out when your balance is at least $25 and your tax form is approved.",
            "You get a downloadable PDF invoice for each payout month, plus a full ledger in Earnings.",
          ]}
        />
        <GuideNote>
          Keep your card/account details and tax form current — a payout that
          can&apos;t be delivered gets paused, not lost.
        </GuideNote>
      </GuideSection>

      <GuideSection step={6} title="Protect your reputation">
        <p>
          Use the in-app chat (PII-filtered) to negotiate terms and share
          updates. If something goes wrong, SLA disputes auto-resolve after 72
          hours — so businesses are held to deadlines just like creators. Deliver
          on time, stay communicative, and the review system rewards you.
        </p>
      </GuideSection>
    </GuidePage>
  );
}
