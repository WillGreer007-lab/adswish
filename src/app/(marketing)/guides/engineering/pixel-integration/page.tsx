import Link from "next/link";
import {
  GuidePage,
  GuideSection,
  GuideList,
  GuideCode,
  GuideNote,
} from "@/components/guides/guide-page";

export const metadata = {
  title: "Pixel integration guide — Engineering",
  description:
    "Install the Adswish tracking pixel with a direct embed, GTM, Shopify, or the Chrome extension, and read the S2S conversion API.",
};

export default function PixelIntegrationGuide() {
  return (
    <GuidePage eyebrow="Engineering" title="Pixel integration guide" readTime="12 min" updated="Aug 2026">
      <GuideSection step={1} title="How attribution works">
        <p>
          Every creator gets a <code className="rounded bg-muted px-1">/t/&#123;slug&#125;</code>{" "}
          link. When a customer clicks it, the edge redirect:
        </p>
        <GuideList
          items={[
            "Checks the link is live (revoked links return 410 Gone, never redirect).",
            "Signs a 24-hour JWT with the link, creator, campaign, and a unique jti.",
            "302s to your destination URL with ?adswish_ref=&#123;JWT&#125; (plus utm_source=adswish).",
          ]}
        />
        <p>
          Your site then reports conversions using that token — either via the
          pixel in the browser or your backend server-to-server. Both hit the
          same webhook, so attribution survives consent blockers.
        </p>
      </GuideSection>

      <GuideSection step={2} title="Option A — direct pixel embed">
        <p>
          Paste this into the <code className="rounded bg-muted px-1">&lt;head&gt;</code> of every
          page. It serves from your Adswish origin, so no hardcoded URLs needed.
        </p>
        <GuideCode label="pixel.js direct embed">
{`<script>
  (function (w, d, id) {
    var js = d.createElement("script");
    js.async = true;
    js.src = "https://<APP_URL>/pixel.js?id=" + encodeURIComponent(id);
    js.onload = function () {
      // consent:true only after the visitor opts in (GDPR).
      if (w.adswish) w.adswish.init({ consent: true, attributionDays: 30 });
    };
    d.head.appendChild(js);
  })(window, document, "<BUSINESS_ID>");
</script>

<!-- On the checkout confirmation page: -->
<script>
  window.adswish && window.adswish.track({ orderId: "ORDER_123", amount: 99.99 });
</script>`}
        </GuideCode>
        <GuideNote>
          Without <code className="rounded bg-muted px-1">consent: true</code> the pixel runs
          analytics-only: no cookie, no attribution. The{" "}
          <code className="rounded bg-muted px-1">_adswish</code> cookie stores the token with a
          30-day lifespan by default.
        </GuideNote>
      </GuideSection>

      <GuideSection step={3} title="Option B — Google Tag Manager">
        <p>
          In GTM, create a <strong>Custom HTML</strong> tag (template in{" "}
          <code className="rounded bg-muted px-1">public/adswish-gtm-tag.html</code>), set the
          business id, and fire it on <strong>All Pages</strong>. On the
          confirmation page add the same{" "}
          <code className="rounded bg-muted px-1">adswish.track(...)</code> call. Shopify users can
          add the direct embed to the theme&apos;s{" "}
          <code className="rounded bg-muted px-1">theme.liquid</code> head, or use a
          “Custom HTML / scripts” app to inject it without editing Liquid.
        </p>
      </GuideSection>

      <GuideSection step={4} title="Option C — Chrome extension (no code)">
        <p>
          Load the unpacked extension from{" "}
          <code className="rounded bg-muted px-1">chrome-extension/</code>, enter your API base URL
          and business id in Options, and optionally set the confirmation-page
          URL pattern + amount selector to auto-fire conversions. It exposes the
          same <code className="rounded bg-muted px-1">window.adswish</code> API and keeps the pixel
          heartbeat alive — see{" "}
          <Link href="/dashboard/business/tracking" className="text-primary underline">
            Settings → Tracking
          </Link>{" "}
          for the exact config values.
        </p>
        <GuideNote>
          The extension only tracks the browser it&apos;s installed on — use the
          script for site-wide attribution.
        </GuideNote>
      </GuideSection>

      <GuideSection step={5} title="Server-to-server conversion API">
        <p>
          Post the stored token from your backend (recommended for carts that
          never load the pixel on the confirmation page):
        </p>
        <GuideCode label="POST /api/v1/webhooks/conversion">
{`POST https://<APP_URL>/api/v1/webhooks/conversion
Content-Type: application/json
Access-Control-Allow-Origin: *   (CORS is enabled)

{
  "token": "<adswish_ref JWT>",
  "orderId": "ORDER_123",
  "amount": 99.99,
  "attribution_method": "s2s"
}`}
        </GuideCode>
        <GuideList
          items={[
            "Idempotent on orderId — retries never double-count.",
            "200 ok · 401 invalid/expired token · 409 already recorded · 410 link revoked · 422 missing fields · 429 rate-limited.",
            "Rate limit: 60/min per IP; the tracking redirect is 100/min per IP.",
          ]}
        />
      </GuideSection>

      <GuideSection step={6} title="Heartbeat & offline penalty">
        <p>
          While a visitor is on your site the pixel pings{" "}
          <code className="rounded bg-muted px-1">POST /api/v1/pixel/ping</code> with your
          business_id every 60s (rate-limited to 12/min). This marks your
          affiliate/hybrid campaigns active. If no ping arrives for 12 hours the
          campaign is warned, then suspended — a fresh ping restores it.
        </p>
      </GuideSection>

      <GuideSection step={7} title="Security notes">
        <GuideList
          items={[
            "Tokens are HS256 JWTs with a 24h TTL and a unique jti per click.",
            "Revoked links/links from paused campaigns return 410 Gone — leaked links die cleanly.",
            "The conversion + ping endpoints allow any origin (no credentials), everything else is locked to the app.",
          ]}
        />
      </GuideSection>
    </GuidePage>
  );
}
