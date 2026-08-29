import { Suspense } from "react";
import { OrderConfirmation } from "./OrderConfirmation";

export const metadata = {
  title: "Order placed",
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
