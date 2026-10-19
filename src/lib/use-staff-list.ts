"use client";

/**
 * =====================================================================
 * A STAFF LIST READ FROM THE SERVER — orders, payment queues, receipts.
 * ---------------------------------------------------------------------
 * The same behaviour as `useServerBookings` (src/lib/use-server-bookings.ts),
 * generalised, so the sections added with payments do not each grow their
 * own copy of it:
 *
 *   - a 401 gets its own sentence (the session expired; reload)
 *   - a failed refresh KEEPS the list already on screen, with a warning,
 *     rather than emptying it — an empty queue reads as "nothing to do",
 *     which is a different and worse claim than "this did not load"
 *   - state is only set after the fetch resolves, with a guard for an
 *     unmount mid-flight
 *
 * `refresh` is returned so a section can reload itself after an action,
 * and so the page can reload the others that the action touched.
 * =====================================================================
 */

import { useCallback, useEffect, useState } from "react";

export interface StaffList<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

async function fetchList<T>(url: string, key: string, what: string) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (response.status === 401) {
      return { items: [] as T[], error: "Your session has expired. Reload the page to sign in again." };
    }
    if (!response.ok) throw new Error(String(response.status));
    const body = (await response.json()) as Record<string, T[]>;
    return { items: body[key] ?? [], error: null };
  } catch {
    return { items: null, error: `Could not load ${what}. They may be out of date.` };
  }
}

export function useStaffList<T>(url: string, key: string, what: string): StaffList<T> {
  const [state, setState] = useState<{ items: T[]; loading: boolean; error: string | null }>({
    items: [],
    loading: true,
    error: null,
  });

  const apply = useCallback((outcome: { items: T[] | null; error: string | null }) => {
    setState((current) => ({
      items: outcome.items ?? current.items,
      loading: false,
      error: outcome.error,
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const outcome = await fetchList<T>(url, key, what);
      if (!cancelled) apply(outcome);
    })();
    return () => {
      cancelled = true;
    };
  }, [url, key, what, apply]);

  const refresh = useCallback(async () => {
    apply(await fetchList<T>(url, key, what));
  }, [url, key, what, apply]);

  return { ...state, refresh };
}

/**
 * POST JSON to a staff endpoint. Returns the parsed body and whether it
 * worked; never throws, so a dropped connection is an ordinary failure
 * the caller shows rather than an unhandled rejection.
 */
export async function postStaff(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}
