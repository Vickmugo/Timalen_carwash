import type { Metadata } from "next";
import { BookingReceipt, NotFound } from "@/components/Receipt";
import { getBookingByRef } from "@/lib/bookings-db";

/**
 * /receipt/booking/[ref] — the printable record of one wash booking.
 *
 * The segment IS the booking reference, WB-4K9T2X and all, taken straight
 * from `makeRef` in src/lib/format.ts. No second identifier was invented
 * for the URL: the whole point of the printed reference is that the code on
 * the paper, the code in the address bar and the code a staff member types
 * into the staff view search are one string.
 *
 * FETCHED ON THE SERVER as of Stage B. The booking comes from the database
 * through src/lib/bookings-db.ts — a direct call, not a hop through
 * /api/bookings/[ref], because a server component is already on the server
 * side of that boundary and the extra HTTP round trip would buy nothing.
 *
 * WHAT THIS CHANGED FOR THE CUSTOMER. This receipt used to be readable only
 * in the browser that made the booking; a link forwarded to anyone else,
 * including the yard, showed "not found". It now renders for whoever holds
 * the reference, which is what a receipt is for. The other side of that
 * coin — the reference is now the only thing protecting a customer's name
 * and phone number — is set out at the top of
 * src/app/api/bookings/[ref]/route.ts.
 *
 * `noindex` still, and app/robots.ts still disallows /receipt: a crawler
 * has no reference to follow, and these pages carry customer details.
 *
 * No `generateStaticParams`: references are created at runtime and there is
 * no build-time list of them, so this route is rendered on demand.
 */
export const metadata: Metadata = {
  title: "Booking receipt",
  description: "A printable record of a wash bay booking.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BookingReceiptPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const booking = await getBookingByRef(ref);

  if (!booking) {
    return (
      <NotFound
        reference={ref}
        backHref="/book"
        backLabel="Book a wash"
        // Not a per-device record any more, so the "try the other phone"
        // explanation would be a wrong steer. See the note on NotFound.
        storedLocally={false}
      />
    );
  }

  return <BookingReceipt booking={booking} />;
}
