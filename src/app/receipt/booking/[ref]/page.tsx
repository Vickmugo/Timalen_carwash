import type { Metadata } from "next";
import { Receipt } from "@/components/Receipt";

/**
 * /receipt/booking/[ref] — the printable record of one wash booking.
 *
 * The segment IS the booking reference, WB-4K9T2X and all, taken straight
 * from `makeRef` in src/lib/format.ts. No second identifier was invented
 * for the URL: the whole point of the printed reference is that the code on
 * the paper, the code in the address bar and the code a staff member types
 * into the staff view search are one string.
 *
 * `noindex`, for the reason app/book/confirmed does: the record is in the
 * visitor's own browser, so a crawler reaching this URL can only ever see
 * the "receipt not found" state, and that is what would get indexed under
 * the business's name. app/robots.ts disallows /receipt as well.
 *
 * No `generateStaticParams`: references are created at runtime and there is
 * no build-time list of them, so this route is rendered on demand.
 */
export const metadata: Metadata = {
  title: "Booking receipt",
  description: "A printable record of a wash bay booking.",
  robots: { index: false, follow: false },
};

export default async function BookingReceiptPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return <Receipt kind="booking" reference={ref} />;
}
