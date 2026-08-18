import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { TanStackQueryProvider } from "@/lib/providers/tanstack-query-provider";
import { TelemetryProvider } from "@/components/telemetry/telemetry-provider";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Adswish — Creator Marketplace",
    template: "%s | Adswish",
  },
  description:
    "Connect businesses with content creators for affiliate, fixed-fee, and hybrid campaigns. Creators keep 90%.",
  keywords: [
    "creator marketplace",
    "influencer marketing",
    "affiliate campaigns",
    "creator economy",
    "adswish",
  ],
  openGraph: {
    title: "Adswish — Creator Marketplace",
    description:
      "Connect businesses with content creators for affiliate, fixed-fee, and hybrid campaigns. Creators keep 90%.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${inter.variable} ${ibmPlexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes into <body>, which otherwise triggers a hydration mismatch. */}
      <body
        className="min-h-full flex flex-col bg-background text-foreground font-sans"
        suppressHydrationWarning
      >
        <TanStackQueryProvider>
          <TelemetryProvider>{children}</TelemetryProvider>
        </TanStackQueryProvider>
        <Analytics />
      </body>
    </html>
  );
}
