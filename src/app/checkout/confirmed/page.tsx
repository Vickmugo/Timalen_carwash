import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderConfirmation } from "./OrderConfirmation";

/**
 * `noindex`, for the same reason as the booking confirmation: without the
 * ?ref of an order the visitor placed themselves this page can only render
 * its "order not found" state, and that is the version a crawler would
 * index. See app/robots.ts, which disallows the path as well.
 */
export const metadata: Metadata = {
  title: "Order placed",
  description: "Your order reference and collection details.",
  robots: { index: false, follow: false },
};

export default function OrderConfirmedPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Suspense fallback={<p className="text-slab-500">Loading your order...</p>}>
        <OrderConfirmation />
      </Suspense>
    </div>
  );
}
