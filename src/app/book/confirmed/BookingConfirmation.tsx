"use client";

import { useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { PaymentBadge } from "@/components/Badge";
import { business } from "@/data/business";
import { formatKes, formatLongDate } from "@/lib/format";
import { useBookings, useIsHydrated } from "@/lib/store";

export function BookingConfirmation() {
  const ref = useSearchParams().get("ref");
  // Records live in localStorage, so nothing is readable until hydration.
  const hydrated = useIsHydrated();
  const booking = useBookings().find((entry) => entry.ref === ref);

  if (!hydrated) return <p className="text-slab-500">Loading your booking...</p>;

  if (!booking) {
    return (
      <div className="rounded-slab border-2 border-slab-200 bg-white p-6">
        <h1 className="text-2xl">Booking not found</h1>
        <p className="mt-2 text-slab-600">
          We could not find a booking with that reference on this device.
        </p>
        <ButtonLink href="/book" className="mt-5">
          Book a wash
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-slab bg-ok-tint"
        >
          <svg viewBox="0 0 20 20" className="size-6 text-ok" fill="none">
            <path
              d="m4 10.5 4 4 8-9"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="text-3xl">Slot booked</h1>
      </div>

      <p className="mt-3 text-slab-600">
        Bring the car to {business.location} at the time below. Keep your
        reference handy.
      </p>

      <div className="mt-6 rounded-slab border-2 border-slab-900 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-slab-900 bg-slab-900 px-4 py-3 text-slab-50">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slab-400">
            Reference
          </span>
          <span className="font-mono text-lg font-bold text-hivis">
            {booking.ref}
          </span>
        </div>

        <dl className="divide-y-2 divide-slab-100">
          {[
            ["Service", booking.serviceName],
            ["Date", formatLongDate(booking.date)],
            ["Time", `${booking.startTime} - ${booking.endTime}`],
            ["Vehicle", booking.vehicle],
            ["Name", booking.customerName],
            ["Phone", booking.phone],
            ...(booking.notes ? [["Notes", booking.notes]] : []),
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex flex-wrap justify-between gap-2 px-4 py-3"
            >
              <dt className="text-sm font-bold uppercase tracking-wide text-slab-500">
                {label}
              </dt>
              <dd className="text-sm font-semibold">{value}</dd>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <dt className="text-sm font-bold uppercase tracking-wide text-slab-500">
              Payment
            </dt>
            <dd className="flex items-center gap-2 text-sm font-semibold">
              {formatKes(booking.priceKes)}
              <PaymentBadge status={booking.paymentStatus} />
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 rounded-slab border-2 border-hivis bg-hivis-tint px-3 py-2 text-sm text-slab-800">
        Demo only. No confirmation SMS is sent and no payment was taken.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/products" variant="outline">
          Browse concrete products
        </ButtonLink>
        <ButtonLink href="/" variant="quiet">
          Back home
        </ButtonLink>
      </div>
    </div>
  );
}
