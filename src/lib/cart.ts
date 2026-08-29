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
import type { CartLine, Product } from "@/types";
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

export function addItem(product: Product, quantity: number): void {
  const current = readLines();
  const existing = current.find((line) => line.productId === product.id);

  writeLines(
    existing
      ? current.map((line) =>
          line.productId === product.id
            ? { ...line, quantity: line.quantity + quantity }
            : line,
        )
      : [
          ...current,
          {
            productId: product.id,
            slug: product.slug,
            name: product.name,
            unitLabel: product.unitLabel,
            priceKes: product.priceKes,
            quantity,
            status: product.status,
            quoteOnly: product.quoteOnly,
          },
        ],
  );
}

export function setQuantity(productId: string, quantity: number): void {
  const current = readLines();
  writeLines(
    quantity <= 0
      ? current.filter((line) => line.productId !== productId)
      : current.map((line) =>
          line.productId === productId ? { ...line, quantity } : line,
        ),
  );
}

export function removeItem(productId: string): void {
  writeLines(readLines().filter((line) => line.productId !== productId));
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
