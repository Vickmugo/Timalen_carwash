import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { hoursSummary } from "@/data/business";
import { washServices } from "@/data/services";
import { formatDuration, formatKes } from "@/lib/format";

export const metadata = {
  title: "Book a Wash",
};

export default function BookIndexPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        eyebrow="Wash bay"
        title="Book a Wash"
        backHref="/"
        backLabel="Home"
        intro={
          <p>
            Pick a service, then choose a time. There is one bay, so each slot
            is held for a single vehicle. {hoursSummary}.
          </p>
        }
      />

      {/* PLACEHOLDER PRICING - see src/data/services.ts */}
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {washServices.map((service) => (
          <li key={service.id}>
            <Link
              href={`/book/${service.id}`}
              className="group flex h-full flex-col rounded-slab border-2 border-slab-200 bg-white p-5 transition-colors duration-150 ease-out hover:border-slab-900"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg">{service.name}</h2>
                <span className="shrink-0 rounded-slab border border-slab-300 bg-slab-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-slab-600">
                  {formatDuration(service.durationMinutes)}
                </span>
              </div>

              <p className="mt-2 text-sm text-slab-600">{service.description}</p>

              <ul className="mt-4 space-y-1.5">
                {service.includes.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-slab-700">
                    <svg
                      viewBox="0 0 16 16"
                      className="mt-1 size-3.5 shrink-0 text-hivis-dark"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="m3 8.5 3.5 3.5L13 5"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex items-baseline justify-between border-t-2 border-slab-100 pt-4">
                <span className="text-2xl font-extrabold">
                  {formatKes(service.priceKes)}
                </span>
                <span className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slab-600 group-hover:text-slab-900">
                  Choose
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-150 ease-out group-hover:translate-x-1"
                  >
                    &rarr;
                  </span>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
