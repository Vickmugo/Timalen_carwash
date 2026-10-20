import type { Metadata } from "next";
import { getOrderByRef } from "@/lib/orders-db";
import { ReceiptPage } from "../../receipt-page";

/**
 * /receipt/order/[ref] — the official receipt for one concrete order, once
 * staff have confirmed the payment. Same arrangement as the booking
 * receipt; see src/app/receipt/receipt-page.tsx.
 *
 * Orders placed before the checkout moved to the database exist only in
 * the browser that placed them; they have no payment record and no
 * official receipt.
 */
export const metadata: Metadata = {
  title: "Order receipt",
  description: "A printable receipt for a concrete products order.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function OrderReceiptPage({ params }: { params: Promise<{ ref: string }> }) {
  return (
    <ReceiptPage
      params={params}
      config={{
        prefix: "OR",
        load: getOrderByRef,
        backHref: (ref) => `/checkout/confirmed?ref=${encodeURIComponent(ref)}`,
        notFoundBack: { href: "/products", label: "Browse products" },
      }}
    />
  );
}
