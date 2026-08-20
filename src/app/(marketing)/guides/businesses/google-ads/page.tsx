import Link from "next/link";
import {
  GuidePage,
  GuideSection,
  GuideList,
  GuideCode,
  GuideNote,
} from "@/components/guides/guide-page";

export const metadata = {
  title: "Google Ads amplification — Business guide",
  description:
    "Connect Google Ads, get your developer token, and launch your first amplified campaign from the Adswish dashboard.",
};

export default function GoogleAdsGuide() {
  return (
    <GuidePage eyebrow="For Businesses" title="Amplify with Google Ads" readTime="10 min" updated="Aug 2026">
      <GuideSection step={1} title="What amplification is">
        <p>
          Once a creator&apos;s deliverable is approved, you can turn that proven
          organic post into a paid Google Ads campaign — right from the dashboard,
          on every plan. You pay Google directly for ad clicks; Adswish charges{" "}
          <strong>zero commission on ad spend</strong>. You only need two things
          before launching: a connected Google Ads account and the developer token.
        </p>
      </GuideSection>

      <GuideSection step={2} title="Create the Google Cloud OAuth client">
        <GuideList
          items={[
            <>Sign in at <Link href="https://console.cloud.google.com" className="text-primary underline">console.cloud.google.com</Link> and create a project.</>,
            "Enable the Google Ads API in APIs & Services → Library.",
            "Configure the OAuth consent screen (External) and add the scope https://www.googleapis.com/auth/adwords.",
            "Create a Web application credential and copy the Client ID and Client Secret.",
          ]}
        />
        <GuideNote>
          Add <code className="rounded bg-muted px-1">https://adswish-lake.vercel.app/api/internal/google-ads/callback</code>{" "}
          (and <code className="rounded bg-muted px-1">http://localhost:3000/api/internal/google-ads/callback</code>{" "}
          for local testing) as authorized redirect URIs — a mismatch here causes
          Google&apos;s &ldquo;redirect_uri_mismatch&rdquo; error.
        </GuideNote>
      </GuideSection>

      <GuideSection step={3} title="Get the developer token">
        <p>
          The token is what lets Adswish create and manage campaigns in your
          account through the API.
        </p>
        <GuideList
          items={[
            "Sign in to ads.google.com with the account you want to amplify from.",
            "Open Tools → API Center (or Access and security → API Center).",
            "Copy the 22-character developer token.",
            "New tokens start at test access — enough to build and test. Apply for standard access before heavy live use.",
          ]}
        />
      </GuideSection>

      <GuideSection step={4} title="Add the credentials to Vercel">
        <GuideCode label="Vercel → Settings → Environment Variables">
{`GOOGLE_OAUTH_CLIENT_ID=<from step 2>
GOOGLE_OAUTH_CLIENT_SECRET=<from step 2>
GOOGLE_OAUTH_REDIRECT_URI=https://adswish-lake.vercel.app/api/internal/google-ads/callback
GOOGLE_ADS_DEVELOPER_TOKEN=<from step 3>`}
        </GuideCode>
        <p>
          Add them for the Production (and Preview) environments, then redeploy.
          Without the token, the connect flow and drafts still work — only live
          launches pause with a clear message.
        </p>
      </GuideSection>

      <GuideSection step={5} title="Connect and amplify">
        <GuideList
          items={[
            "Open Dashboard → Google Ads and click Connect Google Ads.",
            "Approve the OAuth screen and pick the Google Ads account.",
            "On an approved deliverable, click Amplify with Google Ads.",
            "Choose a goal, target location, and daily budget — then Save as Draft or Launch Campaign Now.",
            "Use the dashboard&apos;s Pause / Resume / Inject controls to manage live campaigns.",
          ]}
        />
        <GuideNote>
          Google&apos;s OAuth consent screen must pass their third-party review before
          real businesses can connect. Until then it works for your test accounts.
        </GuideNote>
      </GuideSection>

      <GuideSection step={6} title="Protect your budget">
        <p>
          The auto-kill switch pauses a campaign automatically if it breaches your
          thresholds: max daily spend, max total spend, minimum conversions before
          a kill, and a minimum ROAS. Set them in the Google Ads dashboard and
          Adswish monitors them once the reporting sync is running — you get a
          notification on every auto-pause and can resume at any time.
        </p>
      </GuideSection>

      <GuideSection step={7} title="A/B thumbnail assets">
        <p>
          Approved deliverables with an uploaded video automatically get{" "}
          <strong>three thumbnail variants</strong> extracted from the footage
          (frames at 10%, 50%, and 90% of the video).
        </p>
        <GuideList
          items={[
            "Open Dashboard → Google Ads → A/B thumbnail assets.",
            "Click Generate thumbnails on a deliverable (or let the nightly job do it for you).",
            "Compare Variants A / B / C side by side and click Use this on the winner.",
            "The chosen thumbnail is attached to the campaign and used as the ad creative.",
          ]}
        />
        <GuideNote>
          If a video can&apos;t be processed the variants show a failed state with the
          exact reason — regenerate any time. No video, no thumbnails.
        </GuideNote>
      </GuideSection>

      <GuideSection step={8} title="Google Partner credit">
        <p>
          Through the Google Partners program, eligible businesses can get a £500
          Google Ads credit toward their first amplified campaign. Apply from the{" "}
          <strong>Google Partner credit</strong> panel in the dashboard — the status
          updates here as the application is reviewed.
        </p>
      </GuideSection>

      <GuideSection step={9} title="Read your blended ROAS">
        <p>
          The Blended ROAS view merges both sides of your funnel:{" "}
          <strong>organic revenue</strong> from your Adswish tracking links and{" "}
          <strong>paid revenue</strong> from Google Ads. See revenue by source,
          organic performance day by day, blended revenue, and blended ROAS (total
          revenue ÷ paid spend) — so you always know what the ads add on top of
          your organic results.
        </p>
        <GuideNote>
          Paid figures appear once the developer token is set and the reporting
          sync runs; until then they show honest zeros. Organic figures are always
          live.
        </GuideNote>
      </GuideSection>
    </GuidePage>
  );
}
