"use client";

import Link from "next/link";
import { FulfilmentBadge } from "@/components/Badge";
import { ButtonLink } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { clearCart, removeItem, setQuantity, useCart } from "@/lib/cart";
import { cartLineKey, cartLineName } from "@/lib/cart-line";
import { formatKes } from "@/lib/format";

export default function CartPage() {
  const { lines, hydrated, subtotalKes, evaluation } = useCart();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        eyebrow="Concrete yard"
        title="Your cart"
        backHref="/products"
        backLabel="Keep browsing"
      />

      {!hydrated ? (
        <p className="mt-6 text-slab-500">Loading your cart...</p>
      ) : lines.length === 0 ? (
        <div className="mt-6 rounded-slab border-2 border-slab-200 bg-white p-6 text-center">
          <p className="text-slab-600">Your cart is empty.</p>
          <ButtonLink href="/products" className="mt-4">
            Browse products
          </ButtonLink>
        </div>
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-3">
            {lines.map((line) => (
              <li
                key={cartLineKey(line)}
                className="rounded-slab border-2 border-slab-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/products/${line.slug}`}
                      className="text-base font-bold uppercase tracking-tight hover:underline"
                    >
                      {cartLineName(line)}
                    </Link>
                    <p className="mt-1 text-sm text-slab-500">
                      {formatKes(line.priceKes)} {line.unitLabel}
                    </p>
                  </div>
                  <FulfilmentBadge status={line.status} />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`qty-${cartLineKey(line)}`}
                      className="text-sm font-bold uppercase tracking-wide text-slab-600"
                    >
                      Qty
                    </label>
                    <input
                      id={`qty-${cartLineKey(line)}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={line.quantity}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setQuantity(
                          cartLineKey(line),
                          Number.isFinite(next) ? next : 1,
                        );
                      }}
                      className="w-20 rounded-slab border-2 border-slab-300 bg-white px-2 py-2 text-center text-base font-bold focus:border-slab-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(cartLineKey(line))}
                      className="ml-1 text-sm font-bold uppercase tracking-wide text-slab-500 underline underline-offset-4 transition-colors duration-150 ease-out hover:text-alert"
                    >
                      Remove
                    </button>
                  </div>

                  <span className="text-lg font-extrabold">
                    {formatKes(line.priceKes * line.quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-slab border-2 border-slab-900 bg-white p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold uppercase tracking-wide text-slab-600">
                Subtotal
              </span>
              <span className="text-2xl font-extrabold">
                {formatKes(subtotalKes)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slab-500">
              Delivery is arranged separately and is not included.
            </p>

            {evaluation.requiresQuote ? (
              <div className="mt-5 border-t-2 border-slab-100 pt-5">
                <h2 className="text-base">This order needs a quote</h2>
                <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm text-slab-700">
                  {evaluation.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <ButtonLink
                  href="/quote?from=cart"
                  size="lg"
                  fullWidth
                  className="mt-4"
                >
                  Request a quote
                </ButtonLink>
                <p className="mt-2 text-center text-sm text-slab-500">
                  No payment is taken. We will call you back with a price.
                </p>
              </div>
            ) : (
              <ButtonLink href="/checkout" size="lg" fullWidth className="mt-5">
                Checkout
              </ButtonLink>
            )}
          </div>

          <button
            type="button"
            onClick={clearCart}
            className="mt-4 text-sm font-bold uppercase tracking-wide text-slab-500 underline underline-offset-4 transition-colors duration-150 ease-out hover:text-alert"
          >
            Empty cart
          </button>
        </>
      )}
    </div>
  );
}
