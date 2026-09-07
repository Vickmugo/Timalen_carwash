import { ButtonLink } from "@/components/Button";
import { PaymentBadge } from "@/components/Badge";
import { business } from "@/data/business";
import { formatKes, formatLongDate } from "@/lib/format";
import { bookingLines, bookingVehicleTypeName } from "@/lib/booking";
import { receiptPath } from "@/lib/receipt";
import type { Booking } from "@/types";

/**
 * PRESENTATION ONLY. The booking is fetched by the server component in
 * page.tsx and handed down.
 *
 * No "use client", no hooks, no hydration gate. This used to read the
 * record out of localStorage, which forced all three: the component had to
 * wait for hydration before it could tell "not loaded yet" apart from "no
 * such booking", and it could only ever find a record made in this same
 * browser. The record now comes from the database, so the page renders
 * complete on the first paint and works on any device holding the link.
 */
export function BookingConfirmation({ booking }: { booking: Booking | null }) {
  if (!booking) {
    return (
      <div className="rounded-slab border-2 border-slab-200 bg-white p-6">
        <h1 className="text-2xl">Booking not found</h1>
        <p className="mt-2 text-slab-600">
          We could not find a booking with that reference. Check the link, or
          call the yard on {business.phone}.
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

        {/*
          WHAT WAS BOOKED, ITEMISED — read through `bookingLines`, which
          also covers records made before the price board existed. Those
          come back as a single line and render here identically: somebody
          holding an old reference booked a real slot, and this page has to
          keep working for them. See src/lib/booking.ts.
        */}
        <ul className="divide-y-2 divide-slab-100 border-b-2 border-slab-100">
          {bookingLines(booking).map((line) => (
            <li
              key={line.serviceId}
              className="flex flex-wrap justify-between gap-2 px-4 py-2.5"
            >
              <span className="text-sm font-semibold">{line.name}</span>
              <span className="text-sm font-semibold">
                {formatKes(line.priceKes)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="divide-y-2 divide-slab-100">
          {[
            /*
              The vehicle column the prices came from. Absent on a legacy
              booking — the old flow never asked — and the row is dropped
              rather than guessing a column that was never quoted.
            */
            ...(bookingVehicleTypeName(booking)
              ? [["Priced as", bookingVehicleTypeName(booking) as string]]
              : []),
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
        {/*
          Offered whatever the payment status is. This is the customer's own
          record of what they just booked, and the receipt states the status
          plainly — including "Unpaid". The staff view applies a stricter
          rule; see canIssueReceipt in src/lib/receipt.ts.
        */}
        <ButtonLink href={receiptPath("booking", booking.ref)}>
          View / print receipt
        </ButtonLink>
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
