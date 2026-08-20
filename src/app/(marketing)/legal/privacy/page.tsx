import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Adswish Privacy Policy and Data Processing Agreement",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: August 20, 2026</p>

      <div className="prose prose-sm mt-8 max-w-none space-y-6 text-muted-foreground">
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">
            This policy explains how Adswish collects, uses, and protects your data.
            Payment details are processed by Stripe; we never store full card numbers.
          </p>
        </div>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">1. Data We Collect</h2>
          <p className="mt-2">
            We collect personal data including your name, email address, social media
            account information (via OAuth with your consent), financial information
            (processed by Stripe), and usage data (cookies, IP addresses, device information).
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">2. How We Use Your Data</h2>
          <p className="mt-2">We use your data to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Provide the Adswish marketplace and escrow services</li>
            <li>Track attribution for affiliate and hybrid campaigns</li>
            <li>Process payments and payouts via Stripe</li>
            <li>Prevent fraud and enforce platform policies</li>
            <li>Send transactional emails and notifications</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">3. Cookie Consent</h2>
          <p className="mt-2">
            We use cookies for attribution tracking and analytics. The tracking pixel
            checks for explicit user consent before dropping the first-party cookie.
            If consent is not given, the pixel operates in analytics-only mode.
            Consent is logged with timestamp, consent version, IP hash, and user agent.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">4. Data Controller &amp; Processor</h2>
          <p className="mt-2">
            The business is the data controller for their own site. Adswish is the
            processor and provides the tracking mechanism but does not assume legal
            coverage for the business&apos;s consent flow.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">5. Data Retention</h2>
          <p className="mt-2">
            Personal data is retained for 7 years after account closure for financial
            record-keeping, then anonymized. Marketing/analytics data is retained for
            2 years. Clicks log data older than 90 days is archived to cold storage
            and dropped from the active database.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">6. GDPR Rights</h2>
          <p className="mt-2">Under GDPR, you have the right to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Access your personal data</li>
            <li>Rectify inaccurate data</li>
            <li>Request erasure (&ldquo;right to be forgotten&rdquo;)</li>
            <li>Export your data (Article 20) in machine-readable JSON format</li>
            <li>Object to processing of your data</li>
          </ul>
          <p className="mt-2">
            To exercise these rights, contact{" "}
            <a href="mailto:privacy@adswish.com" className="text-primary hover:underline">
              privacy@adswish.com
            </a>.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">7. Subprocessors</h2>
          <p className="mt-2">
            We use third-party subprocessors to provide our services. The full list
            is published at{" "}
            <a href="/legal/subprocessors" className="text-primary hover:underline">
              /legal/subprocessors
            </a>{" "}
            and updated within 30 days of adding any new vendor.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">8. Google Ads &amp; OAuth Data</h2>
          <p className="mt-2">
            When you connect Google Ads through the platform&apos;s integrations, you
            grant Adswish OAuth access to your Google Ads account. We use that access
            only to list, create, and manage campaigns you choose to amplify, and to
            read performance data for your dashboards. Google OAuth tokens are stored
            encrypted and are never exposed to other users; you can disconnect the
            integration at any time, which revokes our access. Adswish never shares
            your Google Ads data with third parties without your consent, and paid
            (Google Ads) data is reported separately from organic creator traffic.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">9. Session &amp; Inactivity Data</h2>
          <p className="mt-2">
            For security, sessions end automatically after a configurable period of
            inactivity (1–30 minutes, default 1 minute) and when you leave the
            dashboard via the browser back button. No personal data is transmitted to
            us by these timeouts; they simply end the authenticated session on your
            device.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">10. Contact</h2>
          <p className="mt-2">
            For privacy questions or data requests, contact{" "}
            <a href="mailto:privacy@adswish.com" className="text-primary hover:underline">
              privacy@adswish.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
