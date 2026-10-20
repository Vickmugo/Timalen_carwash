import type { Metadata } from "next";
import { getBookingByRef } from "@/lib/bookings-db";
import { ReceiptPage } from "../../receipt-page";

/**
 * /receipt/booking/[ref] — the official receipt for one wash booking, once
 * staff have confirmed the payment.
 *
 * The segment IS the booking reference, so the code on the confirmation,
 * in the address bar and in the staff search is one string. The receipt
 * itself carries its own number (W-000123).
 *
 * Who sees what, and why a visitor gets a plain 404 for everything but an
 * issued receipt: src/app/receipt/receipt-page.tsx. `noindex`, and
 * app/robots.ts disallows /receipt.
 */
export const metadata: Metadata = {
  title: "Booking receipt",
  description: "A printable receipt for a wash bay booking.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function BookingReceiptPage({ params }: { params: Promise<{ ref: string }> }) {
  return (
    <ReceiptPage
      params={params}
      config={{
        prefix: "WB",
        load: getBookingByRef,
        backHref: (ref) => `/book/confirmed?ref=${encodeURIComponent(ref)}`,
        notFoundBack: { href: "/book", label: "Book a wash" },
      }}
    />
  );
}
