import type { Metadata } from "next";
import { Receipt } from "@/components/Receipt";

/**
 * /receipt/order/[ref] — the printable record of one product order.
 *
 * Same shape as the booking receipt route next door, and the same reasoning
 * about the reference in the URL and about `noindex`. See
 * app/receipt/booking/[ref]/page.tsx.
 *
 * There is no /receipt/quote route and there should not be. A quote request
 * is a question with no agreed price and nothing owed; there is nothing to
 * receipt until it becomes an order. See src/lib/receipt.ts.
 */
export const metadata: Metadata = {
  title: "Order receipt",
  description: "A printable record of a concrete products order.",
  robots: { index: false, follow: false },
};

export default async function OrderReceiptPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return <Receipt kind="order" reference={ref} />;
}
