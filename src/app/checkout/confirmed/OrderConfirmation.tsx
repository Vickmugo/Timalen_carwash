"use client";

import { useSearchParams } from "next/navigation";
import { PaymentBadge } from "@/components/Badge";
import { ButtonLink } from "@/components/Button";
import { business } from "@/data/business";
import { cartLineKey, cartLineName } from "@/lib/cart-line";
import { formatKes } from "@/lib/format";
import { receiptPath } from "@/lib/receipt";
import { useIsHydrated, useOrders } from "@/lib/store";

export function OrderConfirmation() {
  const ref = useSearchParams().get("ref");
  const hydrated = useIsHydrated();
  const order = useOrders().find((entry) => entry.ref === ref);

  if (!hydrated) return <p className="text-slab-500">Loading your order...</p>;

  if (!order) {
    return (
      <div className="rounded-slab border-2 border-slab-200 bg-white p-6">
        <h1 className="text-2xl">Order not found</h1>
        <p className="mt-2 text-slab-600">
          We could not find an order with that reference on this device.
        </p>
        <ButtonLink href="/products" className="mt-5">
          Browse products
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-slab bg-ok-tint"
        >
          <svg viewBox="0 0 20 20" className="size-6 text-ok" fill="none">
            <path
              d="m4 10.5 4 4 8-9"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="text-3xl">Order placed</h1>
      </div>

      <p className="mt-3 text-slab-600">
        The yard will call {order.phone} to confirm delivery or collection. Made
        to order items are cast after that call.
      </p>

      <div className="mt-6 rounded-slab border-2 border-slab-900 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-slab-900 bg-slab-900 px-4 py-3 text-slab-50">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slab-400">
            Reference
          </span>
          <span className="font-mono text-lg font-bold text-hivis">
            {order.ref}
          </span>
        </div>

        <ul className="divide-y-2 divide-slab-100">
          {order.lines.map((line) => (
            <li
              key={cartLineKey(line)}
              className="flex flex-wrap justify-between gap-2 px-4 py-3"
            >
              <span className="text-sm">
                <span className="font-semibold">{cartLineName(line)}</span>
                <span className="text-slab-500"> x {line.quantity}</span>
              </span>
              <span className="text-sm font-bold">
                {formatKes(line.priceKes * line.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="divide-y-2 divide-slab-100 border-t-2 border-slab-100">
          {[
            ["Name", order.customerName],
            ["Phone", order.phone],
            ["Deliver to", order.deliveryLocation],
            ...(order.notes ? [["Notes", order.notes]] : []),
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex flex-wrap justify-between gap-2 px-4 py-3"
            >
              <dt className="text-sm font-bold uppercase tracking-wide text-slab-500">
                {label}
              </dt>
              <dd className="text-sm font-semibold">{value}</dd>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slab-50 px-4 py-3">
            <dt className="text-sm font-bold uppercase tracking-wide text-slab-700">
              Total
            </dt>
            <dd className="flex items-center gap-2 text-lg font-extrabold">
              {formatKes(order.subtotalKes)}
              <PaymentBadge status={order.paymentStatus} />
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 rounded-slab border-2 border-hivis bg-hivis-tint px-3 py-2 text-sm text-slab-800">
        Demo only. No payment was taken and nothing has been sent to{" "}
        {business.name}.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {/* See the note on the booking confirmation: offered at any status. */}
        <ButtonLink href={receiptPath("order", order.ref)}>
          View / print receipt
        </ButtonLink>
        <ButtonLink href="/products" variant="outline">
          Keep browsing
        </ButtonLink>
        <ButtonLink href="/" variant="quiet">
          Back home
        </ButtonLink>
      </div>
    </div>
  );
}
