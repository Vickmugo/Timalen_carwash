import { ButtonLink } from "@/components/Button";
import { PaymentStatusNotice } from "@/components/PaymentStatusNotice";
import { business } from "@/data/business";
import { getFlatVehicle } from "@/data/services";
import { formatKes, formatLongDate } from "@/lib/format";
import { receiptPath } from "@/lib/receipt";
import type { PublicBooking } from "@/lib/public-view";

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
/**
 * Renders the MINIMAL view (src/lib/public-view.ts): this page is open to
 * anyone with the ref, so it shows a first name and a masked phone, and no
 * vehicle plate or notes.
 */
export function BookingConfirmation({ booking }: { booking: PublicBooking | null }) {
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
        {/* "the motorbike", not "the car", for a flat-priced vehicle. */}
        Bring the{" "}
        {getFlatVehicle(booking.vehicleTypeId ?? "")?.name.toLowerCase() ?? "car"}{" "}
        to {business.location} at the time below. Keep your reference handy.
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
          {booking.lines.map((line) => (
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
            ...(booking.vehicleTypeName
              ? [["Priced as", booking.vehicleTypeName]]
              : []),
            ["Date", formatLongDate(booking.date)],
            ["Time", `${booking.startTime} - ${booking.endTime}`],
            ["Name", booking.firstName],
            ["Phone", booking.phoneMasked],
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
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slab-50 px-4 py-3">
            <dt className="text-sm font-bold uppercase tracking-wide text-slab-700">
              Total
            </dt>
            <dd className="text-lg font-extrabold">{formatKes(booking.priceKes)}</dd>
          </div>
        </dl>
      </div>

      {/*
        WHERE THE PAYMENT STANDS. "Payment pending verification" or "Pay
        cash at the yard" until staff confirm it; the receipt number and
        the print link appear only after that. See PaymentStatusNotice.
      */}
      <div className="mt-4">
        <PaymentStatusNotice
          payment={booking.payment}
          legacyStatus={booking.paymentStatus}
          context="wash"
          receiptHref={receiptPath("booking", booking.ref)}
        />
      </div>

      <p className="mt-4 text-sm text-slab-600">
        No confirmation SMS is sent. Keep this page or your reference.
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
