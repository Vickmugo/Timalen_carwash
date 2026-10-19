"use client";

/**
 * =====================================================================
 * BOOKINGS IN THE STAFF VIEW — fetched, not subscribed.
 * ---------------------------------------------------------------------
 * The staff view is a large client component with filters, sorting and
 * search all held in React state. Turning it into a server component to
 * read one table would have meant rewriting all of that, so instead it
 * keeps its shape and this hook replaces the one thing that changed: where
 * bookings come from.
 *
 * WHAT IS LOST, AND IT IS WORTH NAMING. `useBookings` in src/lib/store.ts
 * is a `useSyncExternalStore` subscription — a booking made in another tab
 * appeared in the staff view live, because the same browser wrote it. That
 * cannot survive the move: the writer is now a different device entirely.
 * This hook fetches once on mount and again whenever it is told to, and
 * the staff view calls `refresh()` after it changes something.
 *
 * So a booking made by a customer right now does NOT appear in an open
 * staff tab until it is reloaded. That is a real regression in liveness
 * and it is deliberate for this stage: the alternative is polling or a
 * realtime subscription, and this stage was explicitly scoped to neither.
 *
 * NO SUPABASE HERE. This runs in the browser, and the browser has no
 * database credentials — it talks to /api/bookings, which does. The anon
 * key would be refused anyway: grants and RLS are locked to service_role.
 * =====================================================================
 */

import { useCallback, useEffect, useState } from "react";
import type { Booking } from "@/types";

export interface ServerBookings {
  bookings: Booking[];
  /** False once the first fetch has settled, successfully or not. */
  loading: boolean;
  /** A sentence for the staff view to render, or null. */
  error: string | null;
  refresh: () => Promise<void>;
}

/** The outcome of one fetch. `bookings: null` means "keep what you have". */
interface FetchOutcome {
  bookings: Booking[] | null;
  error: string | null;
}

async function fetchBookings(): Promise<FetchOutcome> {
  try {
    const response = await fetch("/api/bookings", { cache: "no-store" });

    /*
      401 is its own message. The session cookie lasts twelve hours (see
      src/lib/session.ts), so the ordinary way to meet this is a tab left
      open overnight — and "sign in again" is a useful thing to be told,
      where a generic failure would send somebody hunting for a fault that
      is not there.
    */
    if (response.status === 401) {
      return {
        bookings: [],
        error: "Your session has expired. Reload the page to sign in again.",
      };
    }
    if (!response.ok) throw new Error(String(response.status));

    const body = (await response.json()) as { bookings: Booking[] };
    return { bookings: body.bookings, error: null };
  } catch {
    /*
      `bookings: null` so the caller KEEPS the list it already has. A staff
      member looking at today's diary when the network drops should carry
      on seeing it, with a warning, rather than watch it empty out — an
      empty table reads as "no bookings today", which is a different and
      much more alarming claim than "this did not load".
    */
    return {
      bookings: null,
      error: "Could not load bookings. They may be out of date.",
    };
  }
}

export function useServerBookings(): ServerBookings {
  const [state, setState] = useState<{
    bookings: Booking[];
    loading: boolean;
    error: string | null;
  }>({ bookings: [], loading: true, error: null });

  const apply = useCallback((outcome: FetchOutcome) => {
    setState((current) => ({
      bookings: outcome.bookings ?? current.bookings,
      loading: false,
      error: outcome.error,
    }));
  }, []);

  /*
    The fetch is started inside the effect and the state is set only after
    it resolves, with a `cancelled` guard for an unmount mid-flight. Not
    just to satisfy the lint rule against setting state synchronously in an
    effect — the guard is what stops a response landing on a component that
    is no longer mounted.
  */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const outcome = await fetchBookings();
      if (!cancelled) apply(outcome);
    })();
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const refresh = useCallback(async () => {
    apply(await fetchBookings());
  }, [apply]);

  return { ...state, refresh };
}

/**
 * Moves one booking's payment status. The server attributes the change to
 * the name on the staff session; nothing about who is sent from here.
 *
 * Returns whether it worked, so the caller can refresh on success and say
 * something on failure. The status change and its history row are written
 * together on the server — see `updateBookingPayment` in
 * src/lib/bookings-db.ts — so there is no path here that changes a status
 * without recording who changed it.
 */
/**
 * Moves a booking's JOB status (booked, in progress, done, cancelled, no
 * show). Same shape as `patchBookingPayment` below: true if it landed.
 */
export async function patchBookingJob(
  ref: string,
  jobStatus: string,
): Promise<boolean> {
  try {
    const response = await fetch(`/api/bookings/${encodeURIComponent(ref)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobStatus }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * LEGACY BOOKINGS ONLY — those made before payments were recorded. The
 * server refuses this for a booking with a payment record (409); its
 * payment moves through the queues instead.
 */
export async function patchBookingPayment(
  ref: string,
  paymentStatus: string,
): Promise<boolean> {
  try {
    const response = await fetch(`/api/bookings/${encodeURIComponent(ref)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
