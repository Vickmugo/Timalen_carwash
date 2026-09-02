import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingConfirmation } from "./BookingConfirmation";

/**
 * `noindex`, and the reason is not privacy — the booking details come from
 * a ?ref the crawler does not have, so it would only ever index the "we
 * could not find that booking" state. A permanent error page in the results
 * under the business's own name is worse than no page. app/robots.ts
 * disallows the path as well; this is the belt to that braces, and it is
 * the half that keeps working if the URL is ever linked from elsewhere.
 */
export const metadata: Metadata = {
  title: "Booking confirmed",
  description: "Your wash bay booking reference and slot details.",
  robots: { index: false, follow: false },
};

export default function BookingConfirmedPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Suspense
        fallback={<p className="text-slab-500">Loading your booking...</p>}
      >
        <BookingConfirmation />
      </Suspense>
    </div>
  );
}
