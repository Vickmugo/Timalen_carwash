"use client";

import { useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { business } from "@/data/business";
import { isRef } from "@/lib/format";

/**
 * "We have it, we will call you." Shows the reference from the URL and
 * nothing else: the request itself is on the server, and there is
 * deliberately no public lookup of a quote request by ref, so this page
 * neither fetches it nor shows the customer's details back.
 *
 * No price is promised here. Bulk and custom work is priced on the call.
 */
export function QuoteSubmitted() {
  const ref = useSearchParams().get("ref") ?? "";

  if (!isRef(ref, "QT")) {
    return (
      <div className="rounded-slab border-2 border-slab-200 bg-white p-6">
        <h1 className="text-2xl">Request not found</h1>
        <p className="mt-2 text-slab-600">
          That link does not carry a quote reference. If you sent a request,
          call the yard on {business.phone} and we can look it up.
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
        It has reached the yard. Someone will call you on the number you gave
        with a price. Bulk and custom jobs are priced on that call, once we
        have confirmed what you need — nothing is charged now.
      </p>

      <div className="mt-6 rounded-slab border-2 border-slab-900 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slab-900 px-4 py-3 text-slab-50">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slab-400">
            Reference
          </span>
          <span className="font-mono text-lg font-bold text-hivis">{ref}</span>
        </div>
      </div>

      <p className="mt-4 text-sm text-slab-600">
        Keep the reference in case you call us first. Collection is from the
        yard at {business.location}.
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
