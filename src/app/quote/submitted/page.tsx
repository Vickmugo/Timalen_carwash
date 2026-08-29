import { Suspense } from "react";
import { QuoteSubmitted } from "./QuoteSubmitted";

export const metadata = {
  title: "Quote request sent",
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
