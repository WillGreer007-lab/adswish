import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subprocessors",
  description: "Adswish subprocessor list",
};

export default function SubprocessorsPage() {
  const subprocessors = [
    { name: "Supabase", purpose: "Database, authentication, file storage, realtime", location: "US/EU" },
    { name: "Stripe", purpose: "Payment processing, Connect Express, Billing, Tax", location: "US" },
    { name: "Upstash", purpose: "Redis rate limiting and caching", location: "US/EU" },
    { name: "Inngest", purpose: "Background job orchestration", location: "US" },
    { name: "Resend", purpose: "Transactional email delivery", location: "US" },
    { name: "Vercel", purpose: "Hosting, Edge Functions, analytics", location: "US" },
    { name: "Sentry", purpose: "Error tracking and monitoring", location: "US/EU" },
    { name: "Cloudmersive", purpose: "Virus scanning of uploaded files", location: "US" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-bold">Subprocessors</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: August 17, 2026
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Adswish uses the following third-party subprocessors to provide our services.
        This list is updated within 30 days of adding any new vendor.
      </p>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-3 pr-4 font-semibold">Subprocessor</th>
              <th className="py-3 pr-4 font-semibold">Purpose</th>
              <th className="py-3 font-semibold">Location</th>
            </tr>
          </thead>
          <tbody>
            {subprocessors.map((s) => (
              <tr key={s.name} className="border-b border-border">
                <td className="py-3 pr-4 font-medium">{s.name}</td>
                <td className="py-3 pr-4 text-muted-foreground">{s.purpose}</td>
                <td className="py-3 text-muted-foreground">{s.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
