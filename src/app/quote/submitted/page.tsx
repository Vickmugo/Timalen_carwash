import type { Metadata } from "next";
import { Suspense } from "react";
import { QuoteSubmitted } from "./QuoteSubmitted";

/**
 * `noindex` — reachable only with the ?ref of a request the visitor just
 * sent, so there is nothing here for a crawler but the "not found" state.
 * Also disallowed in app/robots.ts.
 */
export const metadata: Metadata = {
  title: "Quote request sent",
  description: "Confirmation that your quote request reached the yard.",
  robots: { index: false, follow: false },
};

export default function QuoteSubmittedPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Suspense fallback={<p className="text-slab-500">Loading...</p>}>
        <QuoteSubmitted />
      </Suspense>
    </div>
  );
}
