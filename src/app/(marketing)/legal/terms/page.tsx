import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Adswish Master Service Agreement and Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: August 17, 2026</p>

      <div className="prose prose-sm mt-8 max-w-none space-y-6 text-muted-foreground">
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <p className="text-sm font-medium text-foreground">
            ⚠️ This is placeholder copy for development, not real legal language.
            Have an actual lawyer draft the Master Service Agreement, Privacy Policy,
            Cookie Policy, and DPA before any real user or real money touches the platform.
          </p>
        </div>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">1. Master Service Agreement</h2>
          <p className="mt-2">
            Adswish provides escrow and tracking tools. We are not a party to your
            campaign agreement. We mediate disputes per our SLA policy but do not
            guarantee campaign outcomes. Adswish charges a 10% platform fee on all
            transactions. This fee is non-refundable. By proceeding, you agree to
            our Terms of Service.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">2. Platform Fee</h2>
          <p className="mt-2">
            Adswish charges a flat 10% commission on all transactions. The platform
            absorbs all underlying payment processing fees (e.g., Stripe&apos;s 2.9% + 30¢)
            entirely out of its 10% take. Creators always receive an exact, unreduced
            90% net payout. The 10% platform fee is non-refundable.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">3. Escrow &amp; Payouts</h2>
          <p className="mt-2">
            Funds for approved deliverables are held in escrow for a 7-day period
            beginning at the time of business approval. If no dispute is raised within
            the hold period, funds are automatically released to the creator. Pro and
            Premium creators may opt for instant payout, skipping the 7-day hold.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">4. SLA &amp; Dispute Resolution</h2>
          <p className="mt-2">
            If a creator reports a missing sale or undelivered payment, a 72-hour
            SLA timer begins. Unresolved disputes after 72 hours result in automatic
            campaign drop and tracking link disabling. Three strikes within any
            12-month rolling window result in account suspension for 3 months.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">5. Account Deletion</h2>
          <p className="mt-2">
            Creators cannot delete accounts with available balance greater than $0 or
            holds pending release. If an account is banned by admin, remaining balance
            is forfeited to the platform after 90 days per MSA terms.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">6. Prohibited Conduct</h2>
          <p className="mt-2">
            Users may not bypass the platform to avoid the 10% commission. PII
            (emails, phone numbers, external URLs) is automatically filtered from
            messages. Attempts to circumvent fee structures will result in account
            suspension and potential legal action.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">7. Limitation of Liability</h2>
          <p className="mt-2">
            Broad indemnification clauses may be unenforceable in the EU/UK under
            consumer protection law. Adswish is a service provider, not a party to
            campaign agreements between businesses and creators. We provide the tools
            and infrastructure but do not guarantee campaign outcomes.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">8. Contact</h2>
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
