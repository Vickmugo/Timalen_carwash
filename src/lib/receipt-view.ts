/**
 * =====================================================================
 * WHAT A RECEIPT PAGE MAY SHOW — BUILT ON THE SERVER, AND NOTHING ELSE.
 * ---------------------------------------------------------------------
 * The receipt pages (/receipt/booking, /receipt/order, /receipt/carpet)
 * are reached by a ref, and a ref is not a secret (see
 * src/lib/public-view.ts). They used to hand the whole payment object and
 * the whole receipt row to the page, so the page data carried the full
 * M-Pesa code, a rejection reason, the payment id, staff names and the
 * customer's full name and phone even where the page did not print them.
 *
 * Now the page renders a `ReceiptView` built here, and only that:
 *
 *   STAFF    everything the paper receipt has always shown: full name,
 *            full phone, vehicle, full M-Pesa code, the void reason.
 *   PUBLIC   receipt number and date, the lines, the amount, how it was
 *            paid, FIRST NAME ONLY, the phone masked to its last three
 *            digits, the M-Pesa code masked to its last four, and VOID
 *            with its date. Never the vehicle, the void reason, a staff
 *            name, an internal id, or when the claim was made.
 *
 * Only an ISSUED (or voided) receipt has a public view at all. Anything
 * else — no receipt yet, a claim, a rejection, no such ref — is the same
 * 404 for a visitor; see src/app/receipt/receipt-page.tsx.
 *
 * Pure and free of server imports, so tests/receipt-view.test.ts can run
 * it on fixtures.
 * =====================================================================
 */

import { firstNameOf, maskMpesaCode, maskPhone } from "@/lib/mask";
import type {
  PaymentDestination,
  PaymentMethod,
  PaymentRecordStatus,
  PaymentSummary,
  ReceiptLine,
  ReceiptRecord,
  ReceiptSnapshot,
} from "@/types";

export type ReceiptAudience = "staff" | "public";

export interface ReceiptView {
  audience: ReceiptAudience;
  kind: ReceiptSnapshot["kind"];
  number: string;
  issuedAt: string;
  ref: string;
  lines: ReceiptLine[];
  /** The board column a booking was priced against ("Saloon"). Not personal. */
  pricedAs: string | null;
  /** Older carpet requests: the stored sentence instead of lines. */
  itemText: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  /** Staff only; null on the public view. */
  vehicle: string | null;
  collection: string | null;
  /** Full name for staff, first name for the public. */
  customerName: string;
  /** Full for staff, masked for the public. */
  phone: string;
  amountKes: number;
  /** Cash counted that did not match the expected total. */
  amountDiffers: { expectedKes: number; receivedKes: number } | null;
  method: PaymentMethod;
  destination: PaymentDestination | null;
  /** Full for staff, masked to the last four for the public. */
  mpesaCode: string | null;
  /** Present when the receipt is void. */
  void: { at: string | null; reason: string | null } | null;
}

/** Copies only the fields a line needs, so nothing extra in the snapshot rides along. */
function cleanLines(lines: ReceiptLine[] | undefined): ReceiptLine[] {
  return (lines ?? []).map((line) => ({
    name: line.name,
    variant: line.variant ?? null,
    unit: line.unit ?? null,
    quantity: line.quantity,
    price_kes: line.price_kes,
  }));
}

/**
 * What the receipt page renders. `pending` and the staff `not_found` page
 * are staff-only; a visitor gets either `receipt` or `hidden` (the plain
 * 404), and `hidden` carries nothing at all.
 */
export type ReceiptPageResult =
  | { show: "receipt"; view: ReceiptView }
  | { show: "pending"; ref: string; status: PaymentRecordStatus | null }
  | { show: "not_found" }
  | { show: "hidden" };

/**
 * `receipt` is the issued or voided receipt row for this record's payment,
 * already read, or null when there is none (no record, no payment, a claim
 * still waiting, a rejection, cash not yet taken).
 */
export function receiptPageResult(input: {
  audience: ReceiptAudience;
  record: { ref: string; payment?: Pick<PaymentSummary, "status"> } | null;
  receipt: ReceiptRecord | null;
}): ReceiptPageResult {
  if (input.receipt) {
    return { show: "receipt", view: buildReceiptView(input.receipt, input.audience) };
  }
  if (input.audience !== "staff") return { show: "hidden" };
  if (!input.record) return { show: "not_found" };
  return { show: "pending", ref: input.record.ref, status: input.record.payment?.status ?? null };
}

export function buildReceiptView(receipt: ReceiptRecord, audience: ReceiptAudience): ReceiptView {
  const snap = receipt.snapshot;
  const staff = audience === "staff";
  const isVoid = receipt.status === "void";

  return {
    audience,
    kind: snap.kind,
    number: receipt.number,
    issuedAt: receipt.issuedAt,
    ref: snap.ref,
    lines: cleanLines(snap.lines),
    pricedAs: snap.kind === "booking" ? (snap.priced_as ?? null) : null,
    itemText: snap.item_text ?? null,
    date: snap.kind === "booking" ? (snap.date ?? null) : null,
    startTime: snap.kind === "booking" ? (snap.start_time ?? null) : null,
    endTime: snap.kind === "booking" ? (snap.end_time ?? null) : null,
    vehicle: staff && snap.kind === "booking" ? (snap.vehicle ?? null) : null,
    collection: snap.kind === "order" ? (snap.collection ?? null) : null,
    customerName: staff ? snap.customer_name : firstNameOf(snap.customer_name),
    phone: staff ? snap.phone : maskPhone(snap.phone),
    amountKes: receipt.amountKes,
    amountDiffers: snap.amount_differs
      ? { expectedKes: snap.expected_kes, receivedKes: snap.received_kes }
      : null,
    method: receipt.method,
    destination: snap.destination ?? null,
    mpesaCode: receipt.mpesaCode
      ? staff
        ? receipt.mpesaCode
        : maskMpesaCode(receipt.mpesaCode)
      : null,
    void: isVoid
      ? { at: receipt.voidedAt, reason: staff ? receipt.voidReason : null }
      : null,
  };
}
