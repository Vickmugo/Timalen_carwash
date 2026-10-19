/**
 * =====================================================================
 * PRINTABLE RECEIPT — the official one, and the page before it exists.
 * ---------------------------------------------------------------------
 * AN OFFICIAL RECEIPT EXISTS ONLY ONCE STAFF HAVE CONFIRMED THE MONEY.
 * A receipt number (W-000001, C-000001) is issued by the database at the
 * moment a payment is verified or the cash is received — never at
 * checkout. Until then the receipt routes render `PendingReceipt`, which
 * says plainly that nothing has been confirmed and carries no number, no
 * "Paid" and no print button. A customer cannot print a document that
 * looks like proof of a payment nobody has checked.
 *
 * RENDERED FROM THE SNAPSHOT, NOTHING ELSE. `OfficialReceipt` reads the
 * frozen copy stored on the receipt row when it was issued — names,
 * sizes, quantities, prices, customer — so a later price change, a renamed
 * service or an edited booking can never alter a receipt somebody already
 * holds. A voided receipt still renders, marked VOID, with its number.
 *
 * A SERVER COMPONENT, FED A VIEW MODEL. It takes a `ReceiptView`
 * (src/lib/receipt-view.ts), which is the full receipt for staff and a
 * masked one for anyone else, never the receipt row or the payment. Only
 * the print button is client code (./PrintReceiptButton.tsx), and it takes
 * no props, so no record data reaches the browser except what is printed.
 *
 * DESIGNED FOR PAPER FIRST. What is on screen is the document, shown.
 * Black text, white ground, structure carried by rules and weight rather
 * than colour, one narrow column that reflows onto A4 or Letter. The print
 * rules in globals.css only remove things — the site chrome, the buttons.
 *
 * NO LOGO IMAGE. There is no logo file in this project, and a receipt is
 * the last place to start inventing one.
 *
 * WHAT IT IS NOT. Not a tax invoice. No KRA PIN, no VAT breakdown, no ETR
 * or eTIMS signature. Whether the business must issue eTIMS invoices is a
 * question for its accountant; this number is a record of a payment the
 * yard confirmed, not a tax document.
 *
 * NO PDF LIBRARY. Every browser's print dialog has "Save as PDF".
 * =====================================================================
 */

import { ButtonLink } from "@/components/Button";
import { PrintReceiptButton } from "@/components/PrintReceiptButton";
import { business, hoursSummary } from "@/data/business";
import { formatKes, formatLongDate, formatTimestamp } from "@/lib/format";
import { channelLabel } from "@/lib/payments";
import type { ReceiptView } from "@/lib/receipt-view";
import type { PaymentRecordStatus } from "@/types";

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
 * The letterhead. Text only, every field read from src/data/business.ts.
 *
 * NO "PAY BY M-PESA" LINE ANY MORE. It printed the wash till on every
 * receipt, concrete ones included, and a receipt is a record of money
 * already confirmed — not the place to tell somebody where to send more.
 */
function Letterhead() {
  return (
    <header className="border-b-2 border-slab-900 pb-4">
      {/*
        NO NEGATIVE TRACKING HERE, unlike the header wordmark: at extrabold
        uppercase the word gap is the first thing `tracking-tight` closes,
        and "TIMALEN AUTO" prints as "TIMALENAUTO".
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
      </dl>
    </header>
  );
}

/** Print, and a way back. Screen only — `.no-print` takes it off the paper. */
function ReceiptActions({ backHref }: { backHref: string }) {
  return (
    <div className="no-print mt-8 border-t-2 border-slab-200 pt-6">
      <div className="flex flex-wrap gap-3">
        <PrintReceiptButton />
        <ButtonLink href={backHref} variant="quiet">
          Back
        </ButtonLink>
      </div>
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
 * Nothing to show for that reference. STAFF ONLY: a visitor without a
 * session gets the site's plain 404 for every case, so the page cannot
 * be used to learn which refs exist (src/app/receipt/receipt-page.tsx).
 */
export function NotFound({
  reference,
  backHref,
  backLabel,
}: {
  reference: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <Sheet>
      <h1 className="text-2xl">Receipt not found</h1>
      <p className="mt-2 max-w-prose text-slab-700">
        No record matches <span className="font-mono font-bold">{reference}</span>.
      </p>
      <p className="mt-2 max-w-prose text-sm text-slab-600">
        Check the reference on your confirmation. If it is right, call the yard
        on {business.phone} and they can look it up.
      </p>
      <ButtonLink href={backHref} className="mt-5">
        {backLabel}
      </ButtonLink>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Before the receipt exists                                           */
/* ------------------------------------------------------------------ */

/**
 * NO RECEIPT YET — and the page says why, with no number on it, no "Paid"
 * and no print button. STAFF ONLY, like `NotFound`; it is given the
 * payment's status and nothing else.
 */
export function PendingReceipt({
  reference,
  status,
  backHref,
}: {
  reference: string;
  /** Null for a record made before payments were recorded. */
  status: PaymentRecordStatus | null;
  backHref: string;
}) {
  const message = !status
    ? "This record was made before payments were recorded online, so it has no official receipt. Ask at the yard."
    : status === "claimed"
      ? "Payment pending verification. We check your M-Pesa payment against our statement, and your receipt is issued once it is confirmed."
      : status === "rejected"
        ? "We could not match your M-Pesa payment. The yard will call you to sort it out."
        : status === "cash_due"
          ? "Pay cash at the yard. Your receipt is issued when the cash is received."
          : "Your payment has been confirmed, but the receipt is not ready yet. Call the yard if this does not change.";

  return (
    <Sheet>
      <h1 className="text-2xl">No receipt yet</h1>
      <p className="mt-1 text-xs uppercase tracking-wide text-slab-600">
        Reference <span className="font-mono font-bold">{reference}</span>
      </p>
      <p className="mt-4 max-w-prose rounded-slab border-2 border-slab-900 px-3 py-2 text-sm font-semibold">
        {message}
      </p>
      <ButtonLink href={backHref} variant="outline" className="mt-5">
        Back
      </ButtonLink>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* The official receipt                                                */
/* ------------------------------------------------------------------ */

const TITLES = {
  booking: "Wash booking receipt",
  order: "Product order receipt",
  carpet: "Carpet & sofa receipt",
} as const;

export function OfficialReceipt({
  receipt,
  backHref,
}: {
  receipt: ReceiptView;
  backHref: string;
}) {
  const isVoid = receipt.void !== null;
  const lines = receipt.lines;

  return (
    <Sheet>
      <Letterhead />

      {isVoid ? (
        /*
          VOID, said large and first. The number is still printed — it stays
          used and is never reissued — but nobody reading this sheet can
          take it for a valid receipt.
        */
        <div className="keep-together mt-5 border-4 border-slab-900 px-3 py-2 text-center">
          <p className="text-3xl font-extrabold tracking-[0.3em]">VOID</p>
          <p className="mt-1 text-xs">
            Voided {receipt.void?.at ? formatTimestamp(receipt.void.at) : ""}
            {receipt.void?.reason ? ` — ${receipt.void.reason}` : ""}
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b-2 border-slab-900 pb-3">
        <div>
          <h1 className="text-lg">{TITLES[receipt.kind]}</h1>
          <p className="mt-0.5 text-xs uppercase tracking-wide text-slab-600">
            Issued {formatTimestamp(receipt.issuedAt)}
          </p>
          <p className="mt-0.5 text-xs uppercase tracking-wide text-slab-600">
            Reference <span className="font-mono font-bold">{receipt.ref}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-slab-600">
            Receipt no.
          </p>
          {/* Mono and large: this is the string read aloud down a phone. */}
          <p className="font-mono text-xl font-extrabold">{receipt.number}</p>
        </div>
      </div>

      {lines.length > 0 ? (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slab-900">
              <th className="py-1.5 text-left text-xs font-bold uppercase tracking-wide text-slab-600">
                {receipt.kind === "booking" ? (receipt.pricedAs ?? "Service") : "Item"}
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
            {lines.map((line, index) => (
              <tr key={index} className="border-b border-slab-200">
                <td className="py-1.5 pr-2">
                  <span className="font-semibold">
                    {line.variant ? `${line.name}, ${line.variant}` : line.name}
                  </span>
                  {line.unit ? (
                    <span className="block text-xs text-slab-600">{line.unit}</span>
                  ) : null}
                </td>
                <td className="py-1.5 text-right tabular-nums">{line.quantity}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {line.price_kes === null ? "At the yard" : formatKes(line.price_kes)}
                </td>
                <td className="py-1.5 text-right font-semibold tabular-nums">
                  {line.price_kes === null ? "—" : formatKes(line.price_kes * line.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : receipt.itemText ? (
        <p className="mt-4 whitespace-pre-line text-sm">{receipt.itemText}</p>
      ) : null}

      <dl className="mt-4">
        {receipt.kind === "booking" && receipt.date ? (
          <>
            <Line label="Date" value={formatLongDate(receipt.date)} />
            <Line label="Time" value={`${receipt.startTime ?? ""} - ${receipt.endTime ?? ""}`} />
            {receipt.vehicle ? <Line label="Vehicle" value={receipt.vehicle} /> : null}
          </>
        ) : null}
        {receipt.kind === "order" && receipt.collection ? (
          <Line label="Collection" value={receipt.collection} />
        ) : null}
        <Line label="Customer" value={receipt.customerName} />
        <Line label="Phone" value={receipt.phone} />
      </dl>

      <div className="keep-together mt-4 border-t-2 border-slab-900 pt-3">
        <div className="flex justify-between gap-4">
          <span className="text-sm font-bold uppercase tracking-wide">Amount paid</span>
          <span className="text-lg font-extrabold">{formatKes(receipt.amountKes)}</span>
        </div>
        {receipt.amountDiffers ? (
          /*
            Cash counted at the counter that did not match the expected
            total. Allowed, and said on the paper rather than smoothed over.
          */
          <p className="mt-1 text-xs font-semibold">
            Expected {formatKes(receipt.amountDiffers.expectedKes)}; {formatKes(receipt.amountDiffers.receivedKes)} received.
          </p>
        ) : null}
        <div className="mt-1.5 flex justify-between gap-4">
          <span className="text-sm font-bold uppercase tracking-wide">Paid by</span>
          <span className="text-right text-sm font-extrabold uppercase tracking-wide">
            {receipt.method === "cash"
              ? "Cash"
              : `M-Pesa ${channelLabel(receipt.method, receipt.destination)}`}
          </span>
        </div>
        {receipt.mpesaCode ? (
          <div className="mt-1.5 flex justify-between gap-4">
            <span className="text-sm font-bold uppercase tracking-wide">M-Pesa code</span>
            <span className="font-mono text-sm font-extrabold">{receipt.mpesaCode}</span>
          </div>
        ) : null}
        <div className="mt-1.5 flex justify-between gap-4">
          <span className="text-sm font-bold uppercase tracking-wide">Status</span>
          <span className="text-sm font-extrabold uppercase tracking-wide">
            {isVoid ? "Void" : "Paid"}
          </span>
        </div>
      </div>

      <p className="keep-together mt-4 text-xs text-slab-600">
        This receipt records a payment the yard has confirmed. It is not a
        tax invoice.
      </p>

      <ReceiptActions backHref={backHref} />
    </Sheet>
  );
}
