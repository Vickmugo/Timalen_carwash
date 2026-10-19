"use client";

import { useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { business } from "@/data/business";
import { useIsHydrated, useQuotes } from "@/lib/store";

export function QuoteSubmitted() {
  const ref = useSearchParams().get("ref");
  const hydrated = useIsHydrated();
  const quote = useQuotes().find((entry) => entry.ref === ref);

  if (!hydrated) return <p className="text-slab-500">Loading...</p>;

  if (!quote) {
    return (
      <div className="rounded-slab border-2 border-slab-200 bg-white p-6">
        <h1 className="text-2xl">Request not found</h1>
        <p className="mt-2 text-slab-600">
          We could not find a quote request with that reference on this device.
        </p>
        <ButtonLink href="/quote" className="mt-5">
          Start a new request
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-slab bg-ok-tint"
        >
          <svg viewBox="0 0 20 20" className="size-6 text-ok" fill="none">
            <path
              d="m4 10.5 4 4 8-9"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="text-3xl">Request sent</h1>
      </div>

      <p className="mt-3 text-slab-600">
        Someone from the yard will call {quote.phone} with a price. Bulk and
        custom jobs are quoted after we confirm the load and the distance.
      </p>

      <div className="mt-6 rounded-slab border-2 border-slab-900 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-slab-900 bg-slab-900 px-4 py-3 text-slab-50">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slab-400">
            Reference
          </span>
          <span className="font-mono text-lg font-bold text-hivis">
            {quote.ref}
          </span>
        </div>

        <dl className="divide-y-2 divide-slab-100">
          {[
            ["What you need", quote.item],
            ["Quantity", quote.quantity],
            ["Collection", quote.deliveryLocation],
            ["Name", quote.customerName],
            ["Phone", quote.phone],
            ...(quote.notes ? [["Notes", quote.notes]] : []),
          ].map(([label, value]) => (
            <div key={label} className="px-4 py-3">
              <dt className="text-sm font-bold uppercase tracking-wide text-slab-500">
                {label}
              </dt>
              <dd className="mt-1 whitespace-pre-line text-sm font-semibold">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="mt-4 rounded-slab border-2 border-hivis bg-hivis-tint px-3 py-2 text-sm text-slab-800">
        Demo only. Nothing has been sent to {business.name} and no payment was
        taken.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/products" variant="outline">
          Back to products
        </ButtonLink>
        <ButtonLink href="/" variant="quiet">
          Back home
        </ButtonLink>
      </div>
    </div>
  );
}
