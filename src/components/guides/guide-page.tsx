import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function GuidePage({
  eyebrow,
  title,
  readTime,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  readTime: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <Link
          href="/#guides"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All guides
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
        <h1 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">{title}</h1>
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          <span>{readTime} read</span>
          {updated && (
            <>
              <span>•</span>
              <span>Updated {updated}</span>
            </>
          )}
        </div>
        <div className="mt-10 space-y-10">{children}</div>
      </div>
    </main>
  );
}

export function GuideSection({
  step,
  title,
  children,
}: {
  step?: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
        {step && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
            {step}
          </span>
        )}
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function GuideList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function GuideCode({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-black">
      {label && (
        <div className="border-b border-white/10 px-4 py-2 text-xs font-medium text-white/50">{label}</div>
      )}
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-[#9cdcfe]">{children}</pre>
    </div>
  );
}

export function GuideNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
