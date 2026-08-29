import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { quoteRules } from "@/data/config";
import { QuoteForm } from "./QuoteForm";

export const metadata = {
  title: "Request a quote",
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
