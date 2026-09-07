"use client";

/**
 * =====================================================================
 * PRINTABLE RECEIPT — one component, both record types.
 * ---------------------------------------------------------------------
 * DESIGNED FOR PAPER FIRST. What is on screen here is not a web page with
 * a print stylesheet bolted on; it is the document, shown. Black text,
 * white ground, structure carried by rules and weight rather than colour
 * or fill, one narrow column that reflows onto A4 or Letter without being
 * scaled. The print rules in globals.css only remove things — the site
 * header and footer, the buttons — and flatten the last few greys. Nothing
 * about the layout changes between screen and paper, so what somebody sees
 * before they press Print is what comes out of the printer.
 *
 * NO LOGO IMAGE. There is no logo file in this project — the wordmark is
 * the mark, as in src/components/SiteHeader.tsx — and a receipt is the last
 * place to start inventing one. Halftoned artwork on a mono laser is a grey
 * smear that costs toner and says nothing.
 *
 * WHAT IT IS NOT. Not a tax invoice. It carries no KRA PIN, no VAT
 * breakdown and no ETR signature, none of which exist anywhere in this
 * project, and it should not be described to the client as anything the
 * Revenue Authority would accept. It is a record of what was booked or
 * ordered, what it costs, and what has been paid so far — which is what
 * somebody at a yard gate actually needs.
 *
 * NO PDF LIBRARY, DELIBERATELY. Every browser's print dialog has "Save as
 * PDF" among its destinations, Chrome on Android included. jsPDF or
 * react-pdf would add a dependency, a second layout to keep in step with
 * this one, and worse typography, all to reimplement a button the customer
 * already has.
 * =====================================================================
 */

import { paymentLabel } from "@/components/Badge";
import { Button, ButtonLink } from "@/components/Button";
import { business, hasTillNumber, hoursSummary } from "@/data/business";
import { formatKes, formatLongDate, formatTimestamp } from "@/lib/format";
import { PAYMENTS_ARE_MOCKED } from "@/lib/payment";
import { bookingLines, bookingVehicleTypeName } from "@/lib/booking";
import { useIsHydrated, useOrders } from "@/lib/store";
import type { Booking, Order, PaymentStatus } from "@/types";

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

/** One label/value line, ruled underneath so values track down the page. */
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="keep-together flex justify-between gap-4 border-b border-slab-200 py-1.5">
      <dt className="shrink-0 text-xs font-bold uppercase tracking-wide text-slab-600">
        {label}
      </dt>
      <dd className="text-right text-sm font-semibold">{value}</dd>
    </div>
  );
}

/**
 * The letterhead. Text only, and every field is read from
 * src/data/business.ts, so a receipt cannot drift away from the footer.
 *
 * The M-Pesa line is the one that appears conditionally. The till is
 * supplied now, but the guard stays: blank `tillNumber` and the line drops
 * out whole rather than printing "Buy Goods and Services, Till" with
 * nothing after it, which is worse than saying nothing at all.
 */
function Letterhead() {
  return (
    <header className="border-b-2 border-slab-900 pb-4">
      {/*
        NO NEGATIVE TRACKING HERE, unlike the header wordmark.

        `tracking-tight` subtracts from every advance width on the line, and
        the space glyph is an advance width like any other. At extrabold
        uppercase the word gap is already the narrowest gap on the line — the
        caps have almost no sidebearing to give — so it is the first thing to
        close, and "TIMALEN AUTO" prints as "TIMALENAUTO". Nothing is wrong
        with the string in src/data/business.ts; the space is being rendered
        away.

        Painted-signage tracking is a screen flourish. A letterhead has to
        read as words, so tracking sits at normal and the word gap is opened
        a touch on top, which also survives the drop to 11pt on paper.
      */}
      <p className="text-xl font-extrabold uppercase tracking-normal [word-spacing:0.12em]">
        {business.name}
      </p>
      <p className="mt-0.5 text-sm text-slab-700">{business.tagline}</p>

      <dl className="mt-3 grid gap-x-6 gap-y-0.5 text-xs text-slab-700 sm:grid-cols-2">
        <div className="flex gap-1.5">
          <dt className="font-bold uppercase tracking-wide">Yard</dt>
          <dd>{business.location}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="font-bold uppercase tracking-wide">Phone</dt>
          <dd>{business.phone}</dd>
        </div>
        <div className="flex gap-1.5 sm:col-span-2">
          <dt className="font-bold uppercase tracking-wide">Open</dt>
          <dd>{hoursSummary}</dd>
        </div>
        {hasTillNumber ? (
          /*
            SAID IN THE WORDS ON THE HANDSET. "Buy Goods and Services" is the
            exact menu item the customer is looking for, and a Buy Goods till
            takes no account or reference number. Both halves earn their
            space: "Pay to till 9806711" alone leaves somebody either hunting
            for an account field that does not exist, or entering it under
            Paybill, where this number is not a valid business number at all.
          */
          <div className="flex gap-1.5 sm:col-span-2">
            <dt className="font-bold uppercase tracking-wide">Pay by M-Pesa</dt>
            <dd>
              Buy Goods and Services, till{" "}
              <span className="font-mono font-bold">{business.tillNumber}</span>
              <span className="block">No account or reference number.</span>
            </dd>
          </div>
        ) : null}
      </dl>
    </header>
  );
}

/** What this document is, and the reference it is filed under. */
function DocumentTitle({
  title,
  reference,
  recordedAt,
}: {
  title: string;
  reference: string;
  recordedAt: string;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b-2 border-slab-900 pb-3">
      <div>
        <h1 className="text-lg">{title}</h1>
        <p className="mt-0.5 text-xs uppercase tracking-wide text-slab-600">
          Recorded {formatTimestamp(recordedAt)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs font-bold uppercase tracking-wide text-slab-600">
          Reference
        </p>
        {/* Mono and large: this is the string read aloud down a phone. */}
        <p className="font-mono text-xl font-extrabold">{reference}</p>
      </div>
    </div>
  );
}

/**
 * The money, and the payment state.
 *
 * Nothing here is hardcoded. `paymentLabel` maps the stored value one for
 * one and has no default branch, so an unrecognised status renders as
 * nothing rather than falling back to something reassuring. A receipt for
 * an unpaid booking says Unpaid, in the same place and at the same size as
 * a paid one says Paid.
 */
function Totals({
  totalKes,
  status,
  amountLabel,
}: {
  totalKes: number;
  status: PaymentStatus;
  amountLabel: string;
}) {
  return (
    <div className="keep-together mt-4 border-t-2 border-slab-900 pt-3">
      <div className="flex justify-between gap-4">
        <span className="text-sm font-bold uppercase tracking-wide">
          {amountLabel}
        </span>
        <span className="text-lg font-extrabold">{formatKes(totalKes)}</span>
      </div>
      <div className="mt-1.5 flex justify-between gap-4">
        <span className="text-sm font-bold uppercase tracking-wide">
          Payment status
        </span>
        <span className="text-sm font-extrabold uppercase tracking-wide">
          {paymentLabel(status)}
        </span>
      </div>
    </div>
  );
}

/**
 * Prints, and says on the paper that no money moved.
 *
 * The payment stub reports success after a delay and the record is then
 * stored as `paid`, so a receipt from this build can say Paid about a
 * payment that never happened. People keep receipts, and some of them bring
 * them back. This notice is the difference between a demo artefact and a
 * false record, which is why it prints rather than being screen-only. It
 * comes off by flipping one flag in src/lib/payment.ts, in the same commit
 * that replaces the mock.
 */
function MockPaymentNotice() {
  if (!PAYMENTS_ARE_MOCKED) return null;
  return (
    <p className="keep-together mt-4 border-2 border-slab-900 px-3 py-2 text-xs font-semibold">
      DEMONSTRATION SYSTEM — no payment has been processed and no money has
      moved. Any amount shown as paid was recorded by a test checkout, not by
      M-Pesa. This document is not proof of payment.
    </p>
  );
}

/**
 * Print, and a way back. Screen only — `.no-print` in globals.css takes the
 * whole block off the paper, so the printed sheet ends at the receipt.
 */
function ReceiptActions({ backHref }: { backHref: string }) {
  return (
    <div className="no-print mt-8 border-t-2 border-slab-200 pt-6">
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => window.print()}>Print receipt</Button>
        <ButtonLink href={backHref} variant="quiet">
          Back
        </ButtonLink>
      </div>
      {/*
        The honest answer to "can I send this to someone". A link cannot be
        forwarded usefully — the record is in this browser and nowhere else
        (src/lib/store.ts) — but the PDF the print dialog produces is a file,
        and a file travels fine over WhatsApp.
      */}
      <p className="mt-3 text-sm text-slab-600">
        To keep a copy or send it on WhatsApp, choose{" "}
        <strong className="font-bold">Save as PDF</strong> as the destination
        in the print dialog.
      </p>
    </div>
  );
}

/** The sheet everything sits on. `receipt` is what the print rules target. */
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="receipt mx-auto max-w-2xl bg-white px-4 py-8 sm:px-6">
      {children}
    </div>
  );
}

/**
 * Nothing to print.
 *
 * Records live in one browser's localStorage and nowhere else, so a receipt
 * link opened on a different phone finds nothing — and that, rather than a
 * mistyped reference, is the likeliest way to arrive here. The message says
 * so, because a bare "not found" would send somebody hunting for a typo
 * that is not there.
 */
/**
 * `storedLocally` decides the explanation, because the two record types no
 * longer live in the same place and the old wording is now false for one
 * of them.
 *
 * Orders are still in this browser's localStorage, so "nothing on this
 * device" is the honest answer and the device caveat matters. Bookings
 * moved to the database in Stage B: a booking reference that finds nothing
 * finds nothing anywhere, and telling that customer to try their other
 * phone would send them looking for a record that was never there.
 */
export function NotFound({
  reference,
  backHref,
  backLabel,
  storedLocally = true,
}: {
  reference: string;
  backHref: string;
  backLabel: string;
  storedLocally?: boolean;
}) {
  return (
    <Sheet>
      <h1 className="text-2xl">Receipt not found</h1>
      <p className="mt-2 max-w-prose text-slab-700">
        {storedLocally ? "Nothing on this device matches " : "No record matches "}
        <span className="font-mono font-bold">{reference}</span>.
      </p>
      <p className="mt-2 max-w-prose text-sm text-slab-600">
        {storedLocally
          ? "In this demo, orders are saved only in the browser they were made in. A receipt link opened on another phone, or in a private window, will not find the record even when the reference is correct."
          : "Check the reference on your confirmation. If it is right, call the yard and they can look it up."}
      </p>
      <ButtonLink href={backHref} className="mt-5">
        {backLabel}
      </ButtonLink>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* The receipt                                                         */
/* ------------------------------------------------------------------ */

/**
 * ORDERS ONLY, AND STILL FROM localStorage.
 *
 * The `kind` prop is gone. Bookings moved to the database in Stage B and
 * their receipt is now fetched by the server component at
 * src/app/receipt/booking/[ref]/page.tsx, which renders `BookingReceipt`
 * below directly. Leaving a booking branch in here would have been a trap:
 * it would look up a booking in a store that no longer holds any, and
 * report a real booking as missing.
 *
 * Orders, quotes and change requests are deliberately untouched by that
 * stage — they are still browser records, and this is still how they read.
 */
export function Receipt({ reference }: { reference: string }) {
  const orders = useOrders();
  const hydrated = useIsHydrated();

  if (!hydrated) {
    return (
      <Sheet>
        <p className="text-slab-500">Loading receipt...</p>
      </Sheet>
    );
  }

  const order = orders.find((entry) => entry.ref === reference);
  if (!order) {
    return (
      <NotFound
        reference={reference}
        backHref="/products"
        backLabel="Browse products"
      />
    );
  }
  return <OrderReceipt order={order} />;
}

export function BookingReceipt({ booking }: { booking: Booking }) {
  const lines = bookingLines(booking);
  const vehicleTypeName = bookingVehicleTypeName(booking);

  return (
    <Sheet>
      <Letterhead />
      <DocumentTitle
        title="Wash booking receipt"
        reference={booking.ref}
        recordedAt={booking.createdAt}
      />

      {/*
        THE WORK, ITEMISED, AT THE PRICES THAT WERE CHARGED.

        A table for the same reason the order receipt uses one: amounts have
        to line up down the page, and `break-inside: avoid` on <tr> in the
        print rules keeps a line off the fold.

        The vehicle column is in the header because it is the reason each
        figure is what it is — the same body wash is 200 or 300 depending on
        it, and a receipt that omits it cannot be checked against the board.
        It is absent on bookings made before the board was wired in, and the
        column is then dropped rather than guessed; `bookingLines` turns
        those into one line so the rest of this prints unchanged. See
        src/lib/booking.ts.
      */}
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-slab-900">
            <th className="py-1.5 text-left text-xs font-bold uppercase tracking-wide text-slab-600">
              Service
            </th>
            <th className="py-1.5 text-right text-xs font-bold uppercase tracking-wide text-slab-600">
              {vehicleTypeName ?? "Amount"}
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.serviceId} className="border-b border-slab-200">
              <td className="py-1.5 pr-2 font-semibold">{line.name}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">
                {formatKes(line.priceKes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-4">
        <Line label="Date" value={formatLongDate(booking.date)} />
        <Line label="Time" value={`${booking.startTime} - ${booking.endTime}`} />
        <Line label="Vehicle" value={booking.vehicle} />
        <Line label="Customer" value={booking.customerName} />
        <Line label="Phone" value={booking.phone} />
        {booking.notes ? <Line label="Notes" value={booking.notes} /> : null}
      </dl>

      <Totals
        totalKes={booking.priceKes}
        status={booking.paymentStatus}
        amountLabel="Amount"
      />
      <MockPaymentNotice />
      <ReceiptActions backHref={`/book/confirmed?ref=${booking.ref}`} />
    </Sheet>
  );
}

function OrderReceipt({ order }: { order: Order }) {
  return (
    <Sheet>
      <Letterhead />
      <DocumentTitle
        title="Product order receipt"
        reference={order.ref}
        recordedAt={order.createdAt}
      />

      {/*
        A real table rather than a stack of rows: four columns that have to
        line up down the page, and `break-inside: avoid` on <tr> in the print
        rules keeps a line item off the fold.
      */}
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-slab-900">
            <th className="py-1.5 text-left text-xs font-bold uppercase tracking-wide text-slab-600">
              Item
            </th>
            <th className="py-1.5 text-right text-xs font-bold uppercase tracking-wide text-slab-600">
              Qty
            </th>
            <th className="py-1.5 text-right text-xs font-bold uppercase tracking-wide text-slab-600">
              Unit
            </th>
            <th className="py-1.5 text-right text-xs font-bold uppercase tracking-wide text-slab-600">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => (
            <tr key={line.productId} className="border-b border-slab-200">
              <td className="py-1.5 pr-2">
                <span className="font-semibold">{line.name}</span>
                <span className="block text-xs text-slab-600">
                  {line.unitLabel}
                </span>
              </td>
              <td className="py-1.5 text-right tabular-nums">{line.quantity}</td>
              <td className="py-1.5 text-right tabular-nums">
                {formatKes(line.priceKes)}
              </td>
              <td className="py-1.5 text-right font-semibold tabular-nums">
                {formatKes(line.priceKes * line.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-4">
        <Line label="Customer" value={order.customerName} />
        <Line label="Phone" value={order.phone} />
        <Line label="Deliver to" value={order.deliveryLocation} />
        {order.notes ? <Line label="Notes" value={order.notes} /> : null}
      </dl>

      <Totals
        totalKes={order.subtotalKes}
        status={order.paymentStatus}
        amountLabel="Subtotal"
      />
      <MockPaymentNotice />
      <ReceiptActions backHref={`/checkout/confirmed?ref=${order.ref}`} />
    </Sheet>
  );
}
