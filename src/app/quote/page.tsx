import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { quoteRules } from "@/data/config";
import { QuoteForm } from "./QuoteForm";

/**
 * Names the three cases that actually route here — bulk, custom moulds, and
 * anything needing a site measure — plus the two products the yard casts
 * but does not list. Someone searching for cabros or culverts has no page
 * to land on otherwise, and this is the page that can genuinely help them.
 */
export const metadata: Metadata = {
  title: "Request a quote",
  description:
    "Get a price for bulk concrete orders, custom moulds, or anything needing a site measure — including cabros, air vents, culverts and cornices that are not listed online. Tell us what you need and we will call you back.",
  alternates: { canonical: "/quote" },
  openGraph: {
    title: "Request a quote",
    description:
      "Bulk orders, custom moulds and site measures. Tell us what you need and we will call you back with a price.",
    url: "/quote",
  },
};

export default function QuotePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader
        eyebrow="Concrete yard"
        title="Request a Quote"
        backHref="/products"
        backLabel="Products"
        intro={
          <p>
            For bulk orders over {quoteRules.maxUnitsPerLine} units, custom
            moulds, and anything that needs a site measure. Tell us what you
            need and we will call you back with a price. No payment is taken
            here.
          </p>
        }
      />
      <Suspense fallback={<p className="mt-6 text-slab-500">Loading...</p>}>
        <QuoteForm />
      </Suspense>
    </div>
  );
}
