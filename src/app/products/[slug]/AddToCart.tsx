"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/Button";
import { quoteRules } from "@/data/config";
import { variantNoun } from "@/data/products";
import type { PriceCell, Product, ProductVariant } from "@/types";
import { addItem, useCart } from "@/lib/cart";
import { cartLineName } from "@/lib/cart-line";
import { formatKes } from "@/lib/format";

/**
 * One size of a product with the price the page was rendered with. Built
 * on the server by `variantPrices()`; a null price is a height nobody has
 * priced, which the picker shows and refuses to select.
 */
export interface PricedVariant {
  variant: ProductVariant;
  priceKes: PriceCell;
}

/**
 * THE PRICE, THE HEIGHT PICKER AND THE BASKET CONTROLS, for a product sold
 * by height. A single-price product skips straight to `AddToCart`; the
 * page renders its headline price itself, as it always has.
 *
 * The headline lives in here rather than on the server page because it
 * has to change when the height does.
 *
 * NO HEIGHT IS PRESELECTED, for the reason BookingFlow gives for not
 * preselecting a vehicle column: a default is the height somebody buys
 * without noticing they chose it. Until a height is picked the headline
 * shows the range, and the button says what is missing.
 */
export function VariantAddToCart({
  product,
  variants,
}: {
  product: Product;
  variants: PricedVariant[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = variants.find((entry) => entry.variant.id === selectedId);
  // An unpriced height cannot be clicked, so this is null only before a pick.
  const choice =
    selected && selected.priceKes !== null
      ? { priceKes: selected.priceKes, variant: selected.variant }
      : null;

  const priced = variants
    .map((entry) => entry.priceKes)
    .filter((price): price is number => price !== null);
  const minKes = Math.min(...priced);
  const maxKes = Math.max(...priced);

  return (
    <>
      <div className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-3xl font-extrabold" aria-live="polite">
          {choice
            ? formatKes(choice.priceKes)
            : minKes === maxKes
              ? formatKes(minKes)
              : `${formatKes(minKes)} – ${maxKes.toLocaleString("en-KE")}`}
        </span>
        <span className="text-sm text-slab-500">
          {product.unitLabel}
          {choice ? `, ${choice.variant.label}` : `, depending on ${variantNoun(product)}`}
        </span>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-bold uppercase tracking-wide text-slab-700">
          {variantNoun(product)}
        </legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {variants.map(({ variant, priceKes }) => {
            const active = variant.id === selectedId;
            const unpriced = priceKes === null;
            return (
              <button
                key={variant.id}
                type="button"
                aria-pressed={active}
                disabled={unpriced}
                onClick={() => setSelectedId(variant.id)}
                className={`flex min-h-12 flex-col items-start justify-center rounded-slab border-2 px-4 py-1.5 text-left transition-colors duration-150 ease-plain disabled:cursor-not-allowed disabled:opacity-60 ${
                  active
                    ? "border-slab-900 bg-slab-900 text-slab-50"
                    : "border-slab-200 bg-white text-slab-900 hover:border-slab-500 disabled:hover:border-slab-200"
                }`}
              >
                <span className="text-sm font-bold">{variant.label}</span>
                <span
                  className={`text-xs ${active ? "text-slab-300" : "text-slab-500"}`}
                >
                  {unpriced ? "Price not listed" : formatKes(priceKes)}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <AddToCart product={product} choice={choice} />
    </>
  );
}

/**
 * What is going into the basket: one price, and for a product sold by
 * height, the height that price belongs to.
 *
 * `choice` is null ONLY while a height has not been picked yet. It never
 * stands for an unpriced product — a product with no confirmed price is not
 * offered an add-to-cart control at all (see the guard in page.tsx),
 * because a basket cannot hold "price not listed".
 */
export function AddToCart({
  product,
  choice,
}: {
  product: Product;
  choice: { priceKes: number; variant?: ProductVariant } | null;
}) {
  const [quantity, setQuantity] = useState(1);
  // What was last added, by name, so switching height afterwards cannot
  // leave "Added" sitting under a height that was not the one added.
  const [added, setAdded] = useState<string | null>(null);
  const cartNeedsQuote = useCart().evaluation.requiresQuote;

  // Over the threshold this item alone will force the cart into quote mode.
  // Say so here rather than letting the customer discover it at checkout.
  // Per height: the cart holds one line per height, and the rule is per line.
  const willNeedQuote = quantity > quoteRules.maxUnitsPerLine;

  const quoteHref = `/quote?product=${product.slug}${
    choice?.variant ? `&variant=${choice.variant.id}` : ""
  }&quantity=${quantity}`;

  function handleAdd() {
    if (!choice) return;
    addItem(product, choice.priceKes, quantity, choice.variant);
    setAdded(
      `${quantity} x ${cartLineName({
        name: product.name,
        variantLabel: choice.variant?.label,
      })}`,
    );
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
                setAdded(null);
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
            {choice ? formatKes(choice.priceKes * quantity) : "—"}
          </span>
        </p>
      </div>

      {willNeedQuote ? (
        <div className="mt-4 rounded-slab border-2 border-hivis bg-hivis-tint p-4">
          <p className="text-sm text-slab-800">
            Over {quoteRules.maxUnitsPerLine} units
            {product.variants ? ` of one ${variantNoun(product)}` : ""}, so this goes to a
            quote rather than checkout. You can still add it to the cart — the
            cart will hand you over to the quote form.
          </p>
          <ButtonLink href={quoteHref} size="md" className="mt-3">
            Request a quote now
          </ButtonLink>
        </div>
      ) : null}

      <Button
        size="lg"
        fullWidth
        className="mt-4"
        onClick={handleAdd}
        disabled={!choice}
      >
        {choice ? "Add to cart" : `Pick a ${variantNoun(product)} first`}
      </Button>

      {/*
        STRAIGHT ON TO CHECKOUT from here, beside "View cart", so a customer
        who has what they came for skips the cart page. If the cart now has
        to go to a quote, checkout would only turn them away, so the
        primary button says where they actually go.
      */}
      {added ? (
        <div
          role="status"
          className="mt-3 rounded-slab border-2 border-ok/30 bg-ok-tint px-3 py-3 text-sm font-semibold text-ok"
        >
          <p>Added {added} to your cart.</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {cartNeedsQuote ? (
              <ButtonLink href="/quote?from=cart" size="md" className="min-h-11">
                Request a quote
              </ButtonLink>
            ) : (
              <ButtonLink href="/checkout" size="md" className="min-h-11">
                Checkout
              </ButtonLink>
            )}
            <Link href="/cart" className="flex min-h-11 items-center underline underline-offset-4">
              View cart
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
