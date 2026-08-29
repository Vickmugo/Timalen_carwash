import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { business, hoursSummary } from "@/data/business";
import { productCategories } from "@/data/products";
import { washServices } from "@/data/services";
import { formatDuration, formatKes } from "@/lib/format";

/**
 * Home.
 *
 * The two operations are deliberately NOT blended into a single pitch.
 * Someone arriving here wants one of two unrelated things, and the page
 * splits at the top rather than making them read a paragraph to find out
 * which door is theirs.
 */
export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b-2 border-slab-800 bg-slab-900 text-slab-100">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-hivis">
            {business.location}
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl sm:text-5xl">
            Two trades, one yard
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slab-300">
            A wash bay and a concrete works on the same premise. Pick the one
            you came for.
          </p>
        </div>
      </section>

      {/* The two doors */}
      <section className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <h2 className="sr-only">Choose a service</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Door 1 — the accent block */}
          <Link
            href="/book"
            className="group flex flex-col justify-between rounded-slab border-2 border-hivis bg-hivis p-6 text-slab-900 transition-colors duration-200 ease-out hover:bg-hivis-dark sm:p-8"
          >
            <div>
              <svg
                viewBox="0 0 32 32"
                className="size-9"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5 20h22M7 20l2-7h14l2 7M9 20v3M23 20v3"
                  stroke="#1a1d1e"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M11 7c0 1.1-.9 2-2 2s-2-.9-2-2 2-4 2-4 2 2.9 2 4ZM25 7c0 1.1-.9 2-2 2s-2-.9-2-2 2-4 2-4 2 2.9 2 4Z"
                  fill="#1a1d1e"
                />
              </svg>
              <h3 className="mt-4 text-2xl">Book a Wash</h3>
              <p className="mt-2 text-slab-800">
                Reserve a slot at the bay. Single bay, so the time you pick is
                yours.
              </p>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
              From {formatKes(washServices[0].priceKes)}
              <span
                aria-hidden="true"
                className="transition-transform duration-150 ease-out group-hover:translate-x-1"
              >
                &rarr;
              </span>
            </p>
          </Link>

          {/* Door 2 — the dark block */}
          <Link
            href="/products"
            className="group flex flex-col justify-between rounded-slab border-2 border-slab-900 bg-slab-900 p-6 text-slab-100 transition-colors duration-200 ease-out hover:bg-slab-800 sm:p-8"
          >
            <div>
              <svg
                viewBox="0 0 32 32"
                className="size-9"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 11 16 5l12 6-12 6L4 11Z"
                  stroke="#f5a300"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                <path
                  d="m4 17 12 6 12-6M4 23l12 6 12-6"
                  stroke="#f5a300"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h3 className="mt-4 text-2xl">Browse Concrete Products</h3>
              <p className="mt-2 text-slab-300">
                Cabros, fencing posts and cast decorations. Buy standard items
                online, or ask for a quote on bulk and custom work.
              </p>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-hivis">
              See the catalogue
              <span
                aria-hidden="true"
                className="transition-transform duration-150 ease-out group-hover:translate-x-1"
              >
                &rarr;
              </span>
            </p>
          </Link>
        </div>
      </section>

      {/* Wash summary */}
      <section className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl">At the wash bay</h2>
          <Link
            href="/book"
            className="text-sm font-bold uppercase tracking-wide text-slab-600 underline underline-offset-4 hover:text-slab-900"
          >
            All services
          </Link>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {washServices.map((service) => (
            <li
              key={service.id}
              className="rounded-slab border-2 border-slab-200 bg-white p-4"
            >
              <h3 className="text-base">{service.name}</h3>
              <p className="mt-1 text-sm text-slab-500">
                {formatDuration(service.durationMinutes)}
              </p>
              <p className="mt-2 text-lg font-bold">
                {formatKes(service.priceKes)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Product summary */}
      <section className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl">From the concrete yard</h2>
          <Link
            href="/products"
            className="text-sm font-bold uppercase tracking-wide text-slab-600 underline underline-offset-4 hover:text-slab-900"
          >
            All products
          </Link>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {productCategories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/products?category=${category.id}`}
                className="flex h-full flex-col rounded-slab border-2 border-slab-200 bg-white p-4 transition-colors duration-150 ease-out hover:border-slab-900"
              >
                <h3 className="text-base">{category.name}</h3>
                <p className="mt-2 text-sm text-slab-600">{category.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Practical strip */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-6 rounded-slab border-2 border-slab-200 bg-white p-6 sm:grid-cols-3">
          <div>
            <h2 className="text-sm text-slab-500">Opening hours</h2>
            <p className="mt-1 font-bold">{hoursSummary}</p>
          </div>
          <div>
            <h2 className="text-sm text-slab-500">Find us</h2>
            <p className="mt-1 font-bold">{business.location}</p>
          </div>
          <div>
            <h2 className="text-sm text-slab-500">Big or custom order?</h2>
            <ButtonLink href="/quote" variant="outline" size="sm" className="mt-2">
              Request a quote
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
