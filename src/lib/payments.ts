/**
 * =====================================================================
 * PAYMENTS — the rules both sides agree on.
 * ---------------------------------------------------------------------
 * Pure, safe on either side, like src/lib/booking.ts. The checkout forms
 * use these to show the right instructions and catch a mistyped code
 * before it leaves the phone; the API routes use the SAME functions to
 * decide what is stored, so the two cannot disagree. The browser's check
 * is a convenience. The server's is the rule.
 *
 * PAYMENTS ARE MANUAL. The customer pays by M-Pesa on their own phone,
 * then types the confirmation code from the SMS. That code is a CLAIM:
 * nothing here, and nothing in the database, checks it with Safaricom.
 * Staff check it against the till or paybill statement and only then mark
 * it verified, which is when a receipt number is issued. STK push and
 * automatic confirmation are a later stage.
 * =====================================================================
 */

import { mpesaDestinations } from "@/data/config";
import type {
  PaymentDestination,
  PaymentMethod,
  PaymentRecordStatus,
  PaymentStream,
  PaymentSummary,
} from "@/types";

/**
 * WHAT AN M-PESA CONFIRMATION CODE LOOKS LIKE — AN ASSUMPTION.
 *
 * Ten capital letters and digits, e.g. "QK12ABC345", which is what the
 * codes in M-Pesa SMS messages have looked like. Nobody has confirmed the
 * format with Safaricom or checked it against this till's own messages.
 * If real codes are ever refused here, RELAX THIS ONE CONSTANT: it is the
 * only place the format is written down. The database deliberately does
 * not repeat it — it only insists the code is stored upper-case with no
 * spaces, which the uniqueness rule depends on.
 */
export const MPESA_CODE_PATTERN = /^[A-Z0-9]{10}$/;

/**
 * "  qk12 abc 345 " -> "QK12ABC345". Trim, upper-case, remove every space.
 *
 * Applied BEFORE the uniqueness check, which is the point: a code typed in
 * lower case, or with the spaces some phones add, is the same code, and
 * must hit the same unique index.
 */
export function normaliseMpesaCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidMpesaCode(normalised: string): boolean {
  return MPESA_CODE_PATTERN.test(normalised);
}

/**
 * Where a stream's M-Pesa money goes. Not a choice the customer makes —
 * see `mpesaDestinations` in src/data/config.ts.
 */
export function destinationFor(stream: PaymentStream): PaymentDestination {
  return stream === "concrete" ? "paybill" : "till";
}

/** What the browser sends. Never a status, never an amount. */
export interface PaymentChoice {
  method: PaymentMethod;
  /** Required for M-Pesa, must be null for cash. */
  destination: PaymentDestination | null;
  /** Normalised. Null for cash. */
  mpesaCode: string | null;
}

export type ParsedPaymentChoice =
  | { ok: true; choice: PaymentChoice }
  | { ok: false; detail: string };

/**
 * The customer's payment choice, read from a request body, checked.
 *
 * Reads ONLY `method`, `destination` and `mpesaCode`. Anything else the
 * body carries — a `status`, an `amountKes` — is not looked at, so there is
 * no way for the browser to create a payment that is already verified, or
 * to name its own price. The status is decided below from the method; the
 * amount by the route, from the live price book.
 *
 * `mpesaAllowed` false (a carpet request with an unpriced line) refuses
 * M-Pesa outright: there is no amount to pay against.
 */
export function parsePaymentChoice(
  raw: unknown,
  stream: PaymentStream,
  mpesaAllowed = true,
): ParsedPaymentChoice {
  const body = (raw ?? {}) as {
    method?: unknown;
    destination?: unknown;
    mpesaCode?: unknown;
  };

  if (body.method === "cash") {
    return { ok: true, choice: { method: "cash", destination: null, mpesaCode: null } };
  }

  if (body.method !== "mpesa") {
    return { ok: false, detail: "Choose how you will pay." };
  }
  if (!mpesaAllowed) {
    return {
      ok: false,
      detail: "This can only be paid at the yard, once the price is confirmed.",
    };
  }

  /*
    THE DESTINATION MUST MATCH THE STREAM. Wash and carpets pay to the till,
    concrete to the paybill. The form only ever shows the right one, so a
    mismatch is a stale page or a hand-built request; either way it is
    refused rather than corrected, because "corrected" would mean recording
    a payment the customer may have sent somewhere else.
  */
  const expected = destinationFor(stream);
  if (body.destination !== expected) {
    return {
      ok: false,
      detail:
        expected === "till"
          ? `Pay to the Buy Goods till ${mpesaDestinations.till.tillNumber}, not a paybill.`
          : `Pay to paybill ${mpesaDestinations.paybill.businessNumber}, not a till.`,
    };
  }

  const code = normaliseMpesaCode(typeof body.mpesaCode === "string" ? body.mpesaCode : "");
  if (!code) {
    return { ok: false, detail: "Enter the M-Pesa confirmation code from your SMS." };
  }
  if (!isValidMpesaCode(code)) {
    return {
      ok: false,
      detail:
        "That does not look like an M-Pesa confirmation code. It is 10 letters and numbers, at the start of the SMS.",
    };
  }

  return { ok: true, choice: { method: "mpesa", destination: expected, mpesaCode: code } };
}

/**
 * The status a new payment is created with. The ONLY two the server ever
 * writes on its own; everything else is a staff action.
 */
export function initialStatus(method: PaymentMethod): PaymentRecordStatus {
  return method === "mpesa" ? "claimed" : "cash_due";
}

/** Shown to a customer whose code is already on another payment. */
export const CODE_ALREADY_USED =
  "This M-Pesa code has already been used. Check the code in your SMS, or call the yard.";

/** Money confirmed by staff — the only states a receipt exists for. */
export function isSettled(status: PaymentRecordStatus): boolean {
  return status === "verified" || status === "cash_received";
}

/**
 * Settled AND receipted, read off a summary. A record with a payment that
 * is settled but somehow has no receipt is NOT counted: the receipt is
 * what the customer is owed.
 */
export function hasOfficialReceipt(payment: PaymentSummary | undefined): boolean {
  return Boolean(payment && isSettled(payment.status) && payment.receipt);
}

const statusWords: Record<PaymentRecordStatus, string> = {
  claimed: "Awaiting verification",
  verified: "M-Pesa verified",
  rejected: "M-Pesa not matched",
  cash_due: "Cash due",
  cash_received: "Cash received",
};

/** One spelling of each payment state, for badges and the ledger. */
export function paymentRecordLabel(status: PaymentRecordStatus): string {
  return statusWords[status];
}

/** "Till" / "Paybill" / "Cash" — how the ledger groups money. */
export function channelLabel(method: PaymentMethod, destination: PaymentDestination | null): string {
  if (method === "cash") return "Cash";
  return destination === "paybill" ? "Paybill" : "Till";
}
