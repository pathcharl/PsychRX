import Link from "next/link";
import { PageShell } from "@/components/public/page-shell";

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  return (
    <PageShell
      footerNote="PsychRx is a service of Balance Point Medical Corp"
    >
      <div className="bg-psych-bg py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-sm font-medium text-teal hover:text-teal-700"
          >
            ← Back to home
          </Link>

          <header className="mt-6 border-b border-navy/10 pb-8">
            <h1 className="font-heading text-3xl font-bold text-navy sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 text-sm text-psych-text/60">
              Last updated: {lastUpdated}
            </p>
            <p className="mt-4 text-sm text-psych-text/70">
              PsychRx LLC, a service of Balance Point Medical Corp · Fort Myers,
              Florida
            </p>
          </header>

          <article className="prose-legal mt-8 space-y-8 text-psych-text/80">
            {children}
          </article>
        </div>
      </div>
    </PageShell>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-heading text-xl font-semibold text-navy">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed sm:text-base">
        {children}
      </div>
    </section>
  );
}
