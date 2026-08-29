"use client";

/**
 * MOCK PERSISTENCE — browser localStorage only.
 *
 * There is no database and no API in this demo. Bookings, orders and quote
 * requests are written to localStorage so the admin view has something real
 * to render and so a refresh does not wipe the demo.
 *
 * Consequences the client should understand:
 *  - data lives in ONE browser, on ONE device
 *  - clearing site data erases everything
 *  - two people cannot see each other's bookings
 *
 * Replacing this: keep the exported function and hook signatures, swap the
 * bodies for fetch() calls to real API routes. Nothing else in the app
 * touches storage directly.
 *
 * Components read through the `use*` hooks, which are built on
 * useSyncExternalStore. Snapshots are cached against the raw stored string
 * so repeated reads return the SAME array reference — without that,
 * useSyncExternalStore would re-render forever.
 */

import { useSyncExternalStore } from "react";
import type { Booking, Order, QuoteRequest, QuoteStatus } from "@/types";

const KEYS = {
  bookings: "demo.bookings",
  orders: "demo.orders",
  quotes: "demo.quotes",
} as const;

type StoreKey = keyof typeof KEYS;

/** Stable empty snapshots for the server render. */
const EMPTY_BOOKINGS: Booking[] = [];
const EMPTY_ORDERS: Order[] = [];
const EMPTY_QUOTES: QuoteRequest[] = [];

/* --------------------------- subscription -------------------------- */

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
  // Another tab wrote. Only react to our own keys.
  if (event.key === null || Object.values(KEYS).includes(event.key as never)) {
    notify();
  }
}

export function subscribe(listener: () => void): () => void {
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

/* ------------------------------ reads ------------------------------ */

const rawCache = new Map<StoreKey, { raw: string | null; value: unknown[] }>();
const sortCache = new WeakMap<object, unknown[]>();

function read<T>(key: StoreKey, empty: T[]): T[] {
  if (typeof window === "undefined") return empty;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEYS[key]);
  } catch {
    return empty; // storage blocked (private mode, embedded webview)
  }

  const cached = rawCache.get(key);
  if (cached && cached.raw === raw) return cached.value as T[];

  let value: T[];
  try {
    value = raw ? (JSON.parse(raw) as T[]) : empty;
  } catch {
    value = empty; // corrupt JSON should never break the page
  }
  rawCache.set(key, { raw, value });
  return value;
}

/** Sorts once per underlying array, preserving reference stability. */
function sortedBy<T>(items: T[], compare: (a: T, b: T) => number): T[] {
  if (items.length === 0) return items;
  const hit = sortCache.get(items as object);
  if (hit) return hit as T[];
  const value = [...items].sort(compare);
  sortCache.set(items as object, value);
  return value;
}

function write<T>(key: StoreKey, value: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS[key], JSON.stringify(value));
  } catch {
    // Private-browsing quota errors are ignored in the demo.
  }
  notify();
}

/* ---------------------------- Bookings ---------------------------- */

export function getBookings(): Booking[] {
  return sortedBy(read<Booking>("bookings", EMPTY_BOOKINGS), (a, b) =>
    `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
  );
}

export function addBooking(booking: Booking): void {
  write("bookings", [...read<Booking>("bookings", EMPTY_BOOKINGS), booking]);
}

export function useBookings(): Booking[] {
  return useSyncExternalStore(subscribe, getBookings, () => EMPTY_BOOKINGS);
}

/* ----------------------------- Orders ----------------------------- */

export function getOrders(): Order[] {
  return sortedBy(read<Order>("orders", EMPTY_ORDERS), (a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function addOrder(order: Order): void {
  write("orders", [...read<Order>("orders", EMPTY_ORDERS), order]);
}

export function useOrders(): Order[] {
  return useSyncExternalStore(subscribe, getOrders, () => EMPTY_ORDERS);
}

/* ------------------------- Quote requests ------------------------- */

export function getQuotes(): QuoteRequest[] {
  return sortedBy(read<QuoteRequest>("quotes", EMPTY_QUOTES), (a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function addQuote(quote: QuoteRequest): void {
  write("quotes", [...read<QuoteRequest>("quotes", EMPTY_QUOTES), quote]);
}

export function updateQuoteStatus(ref: string, status: QuoteStatus): void {
  const quotes = read<QuoteRequest>("quotes", EMPTY_QUOTES).map((quote) =>
    quote.ref === ref ? { ...quote, status } : quote,
  );
  write("quotes", quotes);
}

export function useQuotes(): QuoteRequest[] {
  return useSyncExternalStore(subscribe, getQuotes, () => EMPTY_QUOTES);
}

/* ------------------------------ Demo ------------------------------ */

/** Wipes all demo records. Exposed in the admin view. */
export function clearAll(): void {
  if (typeof window === "undefined") return;
  try {
    Object.values(KEYS).forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // ignore
  }
  notify();
}

/**
 * False during the server render and the hydration pass, true afterwards.
 *
 * Lets a component tell "we have not read storage yet" apart from "storage
 * is genuinely empty", without a setState-in-effect.
 */
const noopSubscribe = () => () => {};

export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
