"use client";

/**
 * =====================================================================
 * /book FOR A SIGNED-IN STAFF MEMBER — Customer booking | Walk-in.
 * ---------------------------------------------------------------------
 * Customers never get this file. src/app/book/page.tsx checks the staff
 * session on the server and renders it only for staff, through a dynamic
 * import (StaffBookLoader.tsx), so not one byte of it or of the walk-in
 * form reaches a customer's browser.
 *
 * HIDING THE SWITCH IS NOT THE LOCK. The walk-in routes check the session
 * and the origin on every request; a customer who built this form by hand
 * would still get a 401.
 *
 * WALK-IN BY DEFAULT, REMEMBERED PER DEVICE. Staff on /book are mostly
 * registering a car at the counter. The choice is kept in localStorage,
 * and every read and write is guarded: a browser that refuses storage
 * just starts on Walk-in each time. The line under the switch always says
 * which mode is on, so a customer booking is never registered as a walk-in
 * by mistake, or the other way round.
 *
 * BOTH MODES STAY MOUNTED. Switching hides one and shows the other, so a
 * half-typed walk-in (or a half-picked booking) survives a mistaken tap.
 * =====================================================================
 */

import { useState, useSyncExternalStore } from "react";
import { WalkinForm } from "@/app/admin/Walkins";
import type { PriceBook } from "@/types";
import { BookingFlow } from "./BookingFlow";

type Mode = "customer" | "walkin";

const MODE_KEY = "timalen.book-mode";

/* The mode, in localStorage when it can be, in memory when it cannot. */
let memoryMode: Mode = "walkin";
const listeners = new Set<() => void>();

function readMode(): Mode {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === "customer" || stored === "walkin") return stored;
  } catch {
    // Storage refused (private mode, a locked-down browser): use memory.
  }
  return memoryMode;
}

function writeMode(mode: Mode) {
  memoryMode = mode;
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Remembered for this visit only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const MODES: { value: Mode; label: string; line: string }[] = [
  {
    value: "customer",
    label: "Customer booking",
    line: "Customer booking: a time slot booked ahead, as a customer sees it.",
  },
  {
    value: "walkin",
    label: "Walk-in",
    line: "Walk-in: a car that is here now. No time slot.",
  },
];

export function StaffBook({ priceBook }: { priceBook: PriceBook }) {
  // The server renders Walk-in; the stored choice takes over on hydration.
  const mode = useSyncExternalStore(subscribe, readMode, () => "walkin" as const);
  // A new key per registration: a fresh form, and a fresh request id with it.
  const [opening, setOpening] = useState(0);
  const current = MODES.find((option) => option.value === mode) ?? MODES[1];

  return (
    <>
      <div className="mb-6 rounded-slab border-2 border-slab-900 bg-white p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slab-500">Staff</p>
        <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Booking mode">
          {MODES.map((option) => {
            const active = option.value === mode;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => writeMode(option.value)}
                className={`min-h-12 rounded-slab border-2 px-3 text-sm font-bold uppercase tracking-wide transition-colors duration-150 ease-plain ${
                  active
                    ? "border-slab-900 bg-slab-900 text-slab-50"
                    : "border-slab-200 bg-white text-slab-700 hover:border-slab-500"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p
          aria-live="polite"
          className="mt-3 rounded-slab border-2 border-hivis bg-hivis-tint px-3 py-2 text-sm font-semibold text-slab-900"
        >
          {current.line}
        </p>
      </div>

      <div hidden={mode !== "customer"}>
        <BookingFlow priceBook={priceBook} />
      </div>
      <div hidden={mode !== "walkin"}>
        <WalkinForm
          key={opening}
          onAnother={() => setOpening((value) => value + 1)}
          onChanged={() => {}}
          signInHref="/login"
        />
      </div>
    </>
  );
}
