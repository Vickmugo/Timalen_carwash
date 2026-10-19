import type { Metadata } from "next";
import { getOrderByRef } from "@/lib/orders-db";
import { isRef } from "@/lib/format";
import { publicOrder } from "@/lib/public-view";
import { OrderConfirmation } from "./OrderConfirmation";

/**
 * `noindex`, for the same reason as the booking confirmation: without the
 * ?ref of a real order this page can only render "order not found", and
 * that is the version a crawler would index. app/robots.ts disallows the
 * path as well.
 *
 * FETCHED ON THE SERVER, like /book/confirmed. Orders moved off
 * localStorage; see src/lib/orders-db.ts.
 */
export const metadata: Metadata = {
  title: "Order placed",
  description: "Your order reference and collection details.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OrderConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const { ref } = await searchParams;
  const reference = typeof ref === "string" ? ref : "";
  const found = isRef(reference, "OR") ? await getOrderByRef(reference) : null;
  const order = found ? publicOrder(found) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <OrderConfirmation order={order} />
    </div>
  );
}
