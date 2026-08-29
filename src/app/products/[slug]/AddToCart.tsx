"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/Button";
import { quoteRules } from "@/data/config";
import type { Product } from "@/types";
import { addItem } from "@/lib/cart";
import { formatKes } from "@/lib/format";

export function AddToCart({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  // Over the threshold this item alone will force the cart into quote mode.
  // Say so here rather than letting the customer discover it at checkout.
  const willNeedQuote = quantity > quoteRules.maxUnitsPerLine;

  function handleAdd() {
    addItem(product, quantity);
    setAdded(true);
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="quantity"
            className="text-sm font-bold uppercase tracking-wide text-slab-700"
          >
            Quantity
          </label>
          <div className="flex items-stretch">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              aria-label="Decrease quantity"
              className="flex size-12 items-center justify-center rounded-l-slab border-2 border-r-0 border-slab-300 bg-white text-xl font-bold text-slab-700 transition-colors duration-150 ease-out hover:border-slab-900"
            >
              &minus;
            </button>
            <input
              id="quantity"
              name="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              value={quantity}
              onChange={(event) => {
                const next = Number(event.target.value);
                setQuantity(Number.isFinite(next) && next > 0 ? next : 1);
                setAdded(false);
              }}
              className="w-16 border-y-2 border-slab-300 bg-white text-center text-base font-bold text-slab-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setQuantity((value) => value + 1)}
              aria-label="Increase quantity"
              className="flex size-12 items-center justify-center rounded-r-slab border-2 border-l-0 border-slab-300 bg-white text-xl font-bold text-slab-700 transition-colors duration-150 ease-out hover:border-slab-900"
            >
              +
            </button>
          </div>
        </div>

        <p className="pb-3 text-sm text-slab-600">
          Subtotal{" "}
          <span className="font-bold text-slab-900">
            {formatKes(product.priceKes * quantity)}
          </span>
        </p>
      </div>

      {willNeedQuote ? (
        <div className="mt-4 rounded-slab border-2 border-hivis bg-hivis-tint p-4">
          <p className="text-sm text-slab-800">
            Over {quoteRules.maxUnitsPerLine} units, so this goes to a quote
            rather than checkout. You can still add it to the cart — the cart
            will hand you over to the quote form.
          </p>
          <ButtonLink
            href={`/quote?product=${product.slug}&quantity=${quantity}`}
            size="md"
            className="mt-3"
          >
            Request a quote now
          </ButtonLink>
        </div>
      ) : null}

      <Button size="lg" fullWidth className="mt-4" onClick={handleAdd}>
        Add to cart
      </Button>

      {added ? (
        <p
          role="status"
          className="mt-3 flex flex-wrap items-center gap-2 rounded-slab border-2 border-ok/30 bg-ok-tint px-3 py-2 text-sm font-semibold text-ok"
        >
          Added to your cart.
          <Link href="/cart" className="underline underline-offset-4">
            View cart
          </Link>
        </p>
      ) : null}
    </div>
  );
}
