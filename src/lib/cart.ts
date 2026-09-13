"use client";

/**
 * Cart state.
 *
 * A module-level store backed by localStorage, read through
 * useSyncExternalStore. No context provider is needed: there is one cart
 * per browser, and every component that calls `useCart()` subscribes to the
 * same store.
 *
 * Same snapshot-caching rule as src/lib/store.ts — `readLines()` must return
 * a stable reference while the stored string is unchanged.
 */

import { useMemo, useSyncExternalStore } from "react";
import type { CartLine, Product, ProductVariant } from "@/types";
import { cartLineKey } from "./cart-line";
import { cartSubtotal, evaluateCart, type QuoteEvaluation } from "./quote";

const STORAGE_KEY = "demo.cart";

const EMPTY: CartLine[] = [];

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
  if (event.key === null || event.key === STORAGE_KEY) notify();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

let cachedRaw: string | null = null;
let cachedLines: CartLine[] = EMPTY;

function readLines(): CartLine[] {
  if (typeof window === "undefined") return EMPTY;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }

  if (raw === cachedRaw) return cachedLines;
  cachedRaw = raw;
  try {
    cachedLines = raw ? (JSON.parse(raw) as CartLine[]) : EMPTY;
  } catch {
    cachedLines = EMPTY;
  }
  return cachedLines;
}

function writeLines(next: CartLine[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  notify();
}

/* ---------------------------- mutations ---------------------------- */

/**
 * `priceKes` IS PASSED IN, not read off the product.
 *
 * Products carry no price any more — the figure lives in `product_prices`
 * and reaches the browser as part of a `PriceBook` the server rendered the
 * page with. So the caller, which has that book, supplies the number.
 *
 * The line still COPIES it, exactly as before: a cart line records what
 * the item cost when it was put in the basket, and a price edited by the
 * yard an hour later does not silently re-price a basket somebody is
 * halfway through. That was already the behaviour and it matters more now
 * that prices can move during opening hours.
 *
 * `variant` is REQUIRED for a product sold by height and must be omitted
 * otherwise. Adding the same height again tops up that line; a different
 * height is a new line with its own price and its own quantity, which is
 * what makes the over-50 bulk rule in src/lib/quote.ts apply per height.
 */
export function addItem(
  product: Product,
  priceKes: number,
  quantity: number,
  variant?: ProductVariant,
): void {
  const current = readLines();
  const key = cartLineKey({ productId: product.id, variantId: variant?.id });
  const existing = current.find((line) => cartLineKey(line) === key);

  writeLines(
    existing
      ? current.map((line) =>
          cartLineKey(line) === key
            ? { ...line, quantity: line.quantity + quantity }
            : line,
        )
      : [
          ...current,
          {
            productId: product.id,
            ...(variant
              ? { variantId: variant.id, variantLabel: variant.label }
              : {}),
            slug: product.slug,
            name: product.name,
            unitLabel: product.unitLabel,
            priceKes,
            quantity,
            status: product.status,
            quoteOnly: product.quoteOnly,
          },
        ],
  );
}

/** `lineKey` is `cartLineKey(line)` — a product id alone is ambiguous. */
export function setQuantity(lineKey: string, quantity: number): void {
  const current = readLines();
  writeLines(
    quantity <= 0
      ? current.filter((line) => cartLineKey(line) !== lineKey)
      : current.map((line) =>
          cartLineKey(line) === lineKey ? { ...line, quantity } : line,
        ),
  );
}

export function removeItem(lineKey: string): void {
  writeLines(readLines().filter((line) => cartLineKey(line) !== lineKey));
}

export function clearCart(): void {
  writeLines([]);
}

/* ------------------------------ hook ------------------------------ */

export interface CartView {
  lines: CartLine[];
  /** False until after hydration — tells "not read yet" from "empty". */
  hydrated: boolean;
  itemCount: number;
  subtotalKes: number;
  evaluation: QuoteEvaluation;
}

export function useCart(): CartView {
  const lines = useSyncExternalStore(subscribe, readLines, () => EMPTY);
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return useMemo(
    () => ({
      lines,
      hydrated,
      itemCount: lines.reduce((total, line) => total + line.quantity, 0),
      subtotalKes: cartSubtotal(lines),
      evaluation: evaluateCart(lines),
    }),
    [lines, hydrated],
  );
}
