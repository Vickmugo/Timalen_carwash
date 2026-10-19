import type { Metadata } from "next";
import { NotFound } from "@/components/Receipt";
import { getOrderByRef } from "@/lib/orders-db";
import { ReceiptFor } from "../../ReceiptFor";

/**
 * /receipt/order/[ref] — the official receipt for one concrete order, once
 * staff have confirmed the payment. Same arrangement as the booking
 * receipt next door; read app/receipt/booking/[ref]/page.tsx.
 *
 * FROM THE SERVER now. Orders placed before the checkout moved to the
 * database exist only in the browser that placed them; they have no
 * payment record and no official receipt, and land on "not found" here.
 */
export const metadata: Metadata = {
  title: "Order receipt",
  description: "A printable receipt for a concrete products order.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OrderReceiptPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const order = await getOrderByRef(ref);

  if (!order) {
    return <NotFound reference={ref} backHref="/products" backLabel="Browse products" />;
  }

  return (
    <ReceiptFor
      reference={order.ref}
      payment={order.payment}
      backHref={`/checkout/confirmed?ref=${encodeURIComponent(order.ref)}`}
    />
  );
}
