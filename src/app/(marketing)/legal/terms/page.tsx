import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Adswish Master Service Agreement and Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: August 19, 2026</p>

      <div className="prose prose-sm mt-8 max-w-none space-y-6 text-muted-foreground">
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">
            These terms describe how Adswish operates. They are provided for
            information and are not a substitute for independent legal advice.
          </p>
        </div>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">1. Master Service Agreement</h2>
          <p className="mt-2">
            Adswish is a marketplace that connects businesses with content creators.
            We provide escrow, tracking, analytics, messaging, and payout tools. We
            are not a party to the campaign agreement between a business and a
            creator, and we do not guarantee campaign outcomes. By creating an
            account you agree to these Terms of Service and our Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">2. Platform Fee</h2>
          <p className="mt-2">
            Adswish charges a flat 10% platform fee on campaign transactions. The
            platform absorbs underlying payment processing fees out of its 10% take,
            so creators receive an exact 90% net payout on released earnings. The
            10% platform fee is non-refundable.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">3. Escrow &amp; Payouts</h2>
          <p className="mt-2">
            Funds for approved deliverables are held in escrow for a 7-day period
            beginning at the time of business approval. If no dispute is raised
            within the hold period, funds are automatically released to the creator.
            Pro and Premium creators may opt for instant payout, skipping the 7-day
            hold. Creators must complete the required tax/identity steps and connect
            a payout account before funds can be released.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">4. Business Balance, Top-ups &amp; Cash-outs</h2>
          <p className="mt-2">
            Businesses may hold a pre-paid wallet balance. The balance is separate
            from escrow and subscriptions, and is used to fund fixed-fee campaigns.
            Fixed-fee campaigns draw from the balance at the time a creator is
            accepted; if the balance is insufficient, the campaign may be closed
            automatically and affected applicants notified.
          </p>
          <p className="mt-2">
            Top-ups are processed through our payment provider and are non-refundable
            except where required by law. Businesses may request a cash-out of their
            balance. Cash-outs are subject to a 10% platform fee (the business
            receives 90% of the requested amount) and a minimum cash-out amount.
            Cash-outs are processed after identity and payout account verification.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">5. Tracking Links</h2>
          <p className="mt-2">
            Affiliate and hybrid campaigns require an active, verified tracking link
            or attribution method. Businesses without an active tracking setup may
            be limited to fixed-fee campaigns funded from their balance. Tracking
            links are monitored for availability; extended downtime may result in
            warnings, suspension of attribution, or campaign closure.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">6. SLA &amp; Dispute Resolution</h2>
          <p className="mt-2">
            If a creator reports a missing sale or undelivered payment, a 72-hour
            SLA timer begins. Unresolved disputes after 72 hours result in automatic
            campaign drop and tracking link disabling. Three strikes within any
            12-month rolling window result in account suspension for 3 months.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">7. Account Deletion</h2>
          <p className="mt-2">
            Accounts with an available balance, pending holds, or open disputes
            cannot be deleted until those are resolved. If an account is banned by
            an administrator, remaining balance may be forfeited after 90 days.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">8. Prohibited Conduct</h2>
          <p className="mt-2">
            Users may not bypass the platform to avoid the 10% commission, submit
            fraudulent conversions or follower counts, or abuse the messaging system.
            Personal information (emails, phone numbers, external URLs) is
            automatically filtered from messages. Attempts to circumvent fees or
            platform safeguards may result in account suspension.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">9. Limitation of Liability</h2>
          <p className="mt-2">
            To the fullest extent permitted by law, Adswish is a service provider and
            not a party to campaign agreements. We provide the tools and
            infrastructure but do not guarantee campaign outcomes, sales, or revenue.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">10. Contact</h2>
          <p className="mt-2">
            For questions about these terms, contact{" "}
            <a href="mailto:legal@adswish.com" className="text-primary hover:underline">
              legal@adswish.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
