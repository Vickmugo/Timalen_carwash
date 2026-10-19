import type { Metadata } from "next";
import { NotFound } from "@/components/Receipt";
import { getBookingByRef } from "@/lib/bookings-db";
import { ReceiptFor } from "../../ReceiptFor";

/**
 * /receipt/booking/[ref] — the official receipt for one wash booking, once
 * staff have confirmed the payment. Before that, a page that says so.
 *
 * The segment IS the booking reference, WB-4K9T2X and all, so the code on
 * the confirmation, in the address bar and in the staff search is one
 * string. The receipt itself carries its own number (W-000123).
 *
 * The reference is the only credential, as it is for the booking itself;
 * see src/app/api/bookings/[ref]/route.ts. `noindex`, and app/robots.ts
 * disallows /receipt.
 */
export const metadata: Metadata = {
  title: "Booking receipt",
  description: "A printable receipt for a wash bay booking.",
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
    return <NotFound reference={ref} backHref="/book" backLabel="Book a wash" />;
  }

  return (
    <ReceiptFor
      reference={booking.ref}
      payment={booking.payment}
      backHref={`/book/confirmed?ref=${encodeURIComponent(booking.ref)}`}
    />
  );
}
