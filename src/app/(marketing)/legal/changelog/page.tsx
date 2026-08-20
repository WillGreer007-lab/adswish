import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { CHANGELOG } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Every update to Adswish, in one place.",
};

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Changelog</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every update to Adswish, with timestamps. Download the full history as a PDF for your records.
          </p>
        </div>
        <Link
          href="/legal/changelog/pdf"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </Link>
      </div>

      <ol className="mt-10 space-y-10">
        {CHANGELOG.map((entry) => (
          <li key={entry.version} className="relative border-l border-border pl-6">
            <span className="absolute -left-[7px] top-1.5 h-3.5 w-3.5 rounded-full bg-primary ring-4 ring-background" />

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                {entry.version}
              </span>
              <time className="text-xs text-muted-foreground">{formatDate(entry.date)}</time>
            </div>

            <h2 className="mt-2 font-heading text-xl font-semibold">{entry.title}</h2>

            <ul className="mt-3 space-y-2">
              {entry.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success" />
                  {h}
                </li>
              ))}
            </ul>

            {entry.fixes && entry.fixes.length > 0 && (
              <ul className="mt-2 space-y-2">
                {entry.fixes.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-destructive" />
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
