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
import type {
  Booking,
  Order,
  PaymentStatus,
  QuoteRequest,
  QuoteStatus,
  StatusChange,
} from "@/types";

const KEYS = {
  bookings: "demo.bookings",
  orders: "demo.orders",
  quotes: "demo.quotes",
  /*
    The old localStorage home of staff change requests. Nothing reads or
    writes it any more — they live in `change_requests` now
    (src/lib/change-requests-db.ts). The key stays listed only so "clear
    all" still removes anything left behind in this browser.
  */
  changeRequests: "demo.changeRequests",
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

export function useQuotes(): QuoteRequest[] {
  return useSyncExternalStore(subscribe, getQuotes, () => EMPTY_QUOTES);
}

/* ------------------------ Status changes -------------------------- */

/**
 * ATTRIBUTED STATUS WRITES.
 *
 * Every status change staff can make goes through one of the three
 * exported functions below, and each one prepends a `StatusChange` to the
 * record's `history`. Attribution is not optional anywhere: there is no
 * path in this module that changes a status without stamping it, so a
 * record with a changed status and no history entry cannot happen.
 *
 * `by` is passed in rather than read from the session inside here, so the
 * call site shows what is being recorded instead of picking it up
 * invisibly. It is a self-reported name and NOTHING MORE — see the header
 * of src/lib/session.ts.
 */

/**
 * How many entries to keep per record.
 *
 * A cap rather than an unbounded list because these live in localStorage,
 * which is a ~5MB budget shared by every record in the app, and a status
 * select is one click — a bored afternoon could put hundreds of entries on
 * one quote. Twenty is far more than the staff view displays and still
 * covers any plausible real history. The OLDEST entries fall off the end;
 * that is the right direction, since "who touched this last" is the
 * question actually being asked.
 */
const HISTORY_LIMIT = 20;

function prependChange(
  history: StatusChange[] | undefined,
  to: string,
  by: string,
): StatusChange[] {
  const entry: StatusChange = {
    to,
    // The name on the staff session, passed down from the /admin layout.
    by,
    at: new Date().toISOString(),
  };
  // Most recent first, matching the field's documented order.
  return [entry, ...(history ?? [])].slice(0, HISTORY_LIMIT);
}

/**
 * Applies `changes` to one record and stamps the history in the same write.
 *
 * One helper for all three record types because the differences between
 * them are only which key to write and which field holds the status —
 * everything that matters (find by ref, copy rather than mutate, stamp,
 * persist, notify) is identical, and three copies of it would be three
 * places for the stamp to be forgotten.
 */
function writeStatusChange<T extends { ref: string; history?: StatusChange[] }>(
  key: StoreKey,
  empty: T[],
  ref: string,
  changes: Partial<T>,
  to: string,
  by: string,
): void {
  const next = read<T>(key, empty).map((record) =>
    record.ref === ref
      ? { ...record, ...changes, history: prependChange(record.history, to, by) }
      : record,
  );
  write(key, next);
}

export function updateQuoteStatus(
  ref: string,
  status: QuoteStatus,
  by: string,
): void {
  writeStatusChange<QuoteRequest>(
    "quotes",
    EMPTY_QUOTES,
    ref,
    { status },
    status,
    by,
  );
}

export function updateBookingPayment(
  ref: string,
  paymentStatus: PaymentStatus,
  by: string,
): void {
  writeStatusChange<Booking>(
    "bookings",
    EMPTY_BOOKINGS,
    ref,
    { paymentStatus },
    paymentStatus,
    by,
  );
}

export function updateOrderPayment(
  ref: string,
  paymentStatus: PaymentStatus,
  by: string,
): void {
  writeStatusChange<Order>(
    "orders",
    EMPTY_ORDERS,
    ref,
    { paymentStatus },
    paymentStatus,
    by,
  );
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
