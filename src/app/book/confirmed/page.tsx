import type { Metadata } from "next";
import { getBookingByRef } from "@/lib/bookings-db";
import { isRef } from "@/lib/format";
import { publicBooking } from "@/lib/public-view";
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

/**
 * A SERVER COMPONENT NOW, and the Suspense wrapper is gone with the client
 * hooks that needed it.
 *
 * This page used to read the booking out of localStorage, which meant it
 * could only render in the browser, only after hydration, and only on the
 * device that made the booking. All three are gone: the record is fetched
 * here, on the server, straight through src/lib/bookings-db.ts with the
 * service-role key — no HTTP hop through a route handler, because a server
 * component calling into the database is already on the right side of the
 * boundary.
 *
 * `dynamic` is forced because the answer depends entirely on a query
 * string and on a table that changes every time somebody books.
 */
export const dynamic = "force-dynamic";

export default async function BookingConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const found = ref && isRef(ref, "WB") ? await getBookingByRef(ref) : null;
  const booking = found ? publicBooking(found) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <BookingConfirmation booking={booking} />
    </div>
  );
}
