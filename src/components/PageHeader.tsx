import Link from "next/link";
import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  backHref?: string;
  backLabel?: string;
}

export function PageHeader({
  eyebrow,
  title,
  intro,
  backHref,
  backLabel = "Back",
}: PageHeaderProps) {
  return (
    <div className="border-b-2 border-slab-200 pb-6">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slab-500 transition-colors duration-150 ease-out hover:text-slab-900"
        >
          <svg
            viewBox="0 0 16 16"
            className="size-3.5"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M10 3 5 8l5 5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {backLabel}
        </Link>
      ) : null}

      {eyebrow ? (
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-hivis-dark">
          {eyebrow}
        </p>
      ) : null}

      <h1 className="mt-1 text-3xl sm:text-4xl">{title}</h1>

      {intro ? (
        <div className="mt-3 max-w-2xl text-slab-600">{intro}</div>
      ) : null}
    </div>
  );
}
