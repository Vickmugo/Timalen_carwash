/**
 * =====================================================================
 * PAYMENTS AND RECEIPTS, IN THE DATABASE.
 * ---------------------------------------------------------------------
 * SERVER ONLY, like src/lib/bookings-db.ts: every function reaches for the
 * service-role client. The API routes are the boundary.
 *
 * TWO KINDS OF WRITE, AND THEY GO DIFFERENT WAYS.
 *
 *   Creating a payment   a plain insert, by the booking/order/carpet
 *                        writers, always `claimed` or `cash_due`.
 *
 *   Moving a payment     ONLY through `resolve_payment()` in the database
 *                        (supabase/migrations/20261017200000_payments_and_receipts.sql),
 *                        which changes the status, mirrors it onto the
 *                        parent, writes `status_changes` and issues the
 *                        receipt in ONE transaction. Nothing here UPDATEs
 *                        `payments.status` directly, and nothing here
 *                        inserts into `receipts`.
 *
 * Receipt numbers are the database's to give out. See `issue_receipt()`.
 * =====================================================================
 */

import { BUSINESS_ID, getSupabaseServiceRoleClient } from "@/lib/supabase";
import { initialStatus, type PaymentChoice } from "@/lib/payments";
import type {
  PaymentDestination,
  PaymentMethod,
  PaymentRecordStatus,
  PaymentStream,
  PaymentSummary,
  ReceiptRecord,
  ReceiptSnapshot,
  ReceiptStatus,
} from "@/types";

/* ------------------------------------------------------------------ */
/* Reading payments off a parent record                                */
/* ------------------------------------------------------------------ */

/**
 * Embedded in the booking, order and carpet selects, so a record arrives
 * with its payments and their receipts in the same request.
 */
export const PAYMENT_EMBED =
  "payments(id, method, destination, status, amount_kes, amount_received_kes, " +
  "mpesa_code, claimed_at, reject_reason, receipts(number, status, issued_at))";

export interface PaymentRow {
  id: string;
  method: PaymentMethod;
  destination: PaymentDestination | null;
  status: PaymentRecordStatus;
  amount_kes: number;
  amount_received_kes: number | null;
  mpesa_code: string | null;
  claimed_at: string;
  reject_reason: string | null;
  receipts?: { number: string; status: ReceiptStatus; issued_at: string }[] | null;
}

function toIso(timestamp: string): string {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? timestamp : parsed.toISOString();
}

export function toPaymentSummary(row: PaymentRow): PaymentSummary {
  const receipt = row.receipts?.[0];
  return {
    id: row.id,
    method: row.method,
    destination: row.destination,
    status: row.status,
    amountKes: row.amount_kes,
    amountReceivedKes: row.amount_received_kes,
    mpesaCode: row.mpesa_code,
    claimedAt: toIso(row.claimed_at),
    rejectReason: row.reject_reason,
    receipt: receipt
      ? { number: receipt.number, status: receipt.status, issuedAt: toIso(receipt.issued_at) }
      : null,
  };
}

/**
 * The payment a record's pages talk about: the most recent attempt. There
 * is one per record today (no self-serve resubmission), but the table is
 * one row per attempt, so the reader picks rather than assumes.
 */
export function latestPayment(rows: PaymentRow[] | null | undefined): PaymentSummary | undefined {
  if (!rows || rows.length === 0) return undefined;
  const latest = rows.slice().sort((a, b) => b.claimed_at.localeCompare(a.claimed_at))[0];
  return toPaymentSummary(latest);
}

/* ------------------------------------------------------------------ */
/* Creating one                                                        */
/* ------------------------------------------------------------------ */

/** Postgres SQLSTATE for a unique-constraint violation. */
const UNIQUE_VIOLATION = "23505";

export type PaymentParent =
  | { bookingId: string }
  | { orderId: string }
  | { quoteRequestId: string };

export type InsertPaymentResult =
  | { ok: true }
  | { ok: false; reason: "code_used" }
  | { ok: false; reason: "db_error"; detail: string };

/**
 * Is this (normalised) code already on a LIVE payment? Asked before a
 * booking is written, so a reused code is turned away without holding a
 * slot. Rejected claims do not count: once staff reject a claim the code
 * is free again, matching the partial unique index in
 * supabase/migrations/20261018100000_rate_limits_and_code_index.sql.
 * Advisory only — the index is the guarantee, and `insertPayment` reports
 * a violation of it as `code_used` too.
 */
export async function isCodeInUse(code: string): Promise<boolean> {
  const db = getSupabaseServiceRoleClient();
  const { data, error } = await db
    .from("payments")
    .select("id")
    .eq("mpesa_code", code)
    .neq("status", "rejected")
    .limit(1);
  if (error) throw new Error(`isCodeInUse: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * Writes the payment row for a record that has just been created.
 *
 * `amountKes` comes from the caller, which computed it from the live price
 * book. The status comes from `initialStatus` — `claimed` or `cash_due` —
 * and from nowhere else.
 */
export async function insertPayment(
  parent: PaymentParent,
  stream: PaymentStream,
  choice: PaymentChoice,
  amountKes: number,
): Promise<InsertPaymentResult> {
  const db = getSupabaseServiceRoleClient();
  const { error } = await db.from("payments").insert({
    business_id: BUSINESS_ID,
    stream,
    method: choice.method,
    destination: choice.destination,
    amount_kes: amountKes,
    mpesa_code: choice.mpesaCode,
    status: initialStatus(choice.method),
    booking_id: "bookingId" in parent ? parent.bookingId : null,
    order_id: "orderId" in parent ? parent.orderId : null,
    quote_request_id: "quoteRequestId" in parent ? parent.quoteRequestId : null,
  });

  if (!error) return { ok: true };
  if (error.code === UNIQUE_VIOLATION) return { ok: false, reason: "code_used" };
  return { ok: false, reason: "db_error", detail: error.message };
}

/* ------------------------------------------------------------------ */
/* The staff queues                                                    */
/* ------------------------------------------------------------------ */

/** A payment with enough of its parent to act on it at the counter. */
export interface QueuedPayment {
  id: string;
  stream: PaymentStream;
  method: PaymentMethod;
  destination: PaymentDestination | null;
  status: PaymentRecordStatus;
  amountKes: number;
  mpesaCode: string | null;
  claimedAt: string;
  /** "booking" / "order" / "carpet", and the printed reference. */
  kind: "booking" | "order" | "carpet";
  ref: string;
  customerName: string;
  phone: string;
  /**
   * Carpet requests only: pieces with no price on the board, so the
   * expected amount covers only part of the job. Staff take the real
   * total at the counter.
   */
  unpricedPieces: number;
}

interface QueueRow {
  id: string;
  stream: PaymentStream;
  method: PaymentMethod;
  destination: PaymentDestination | null;
  status: PaymentRecordStatus;
  amount_kes: number;
  mpesa_code: string | null;
  claimed_at: string;
  bookings: { ref: string; customer_name: string; phone: string } | null;
  orders: { ref: string; customer_name: string; phone: string } | null;
  quote_requests: {
    ref: string;
    customer_name: string;
    phone: string;
    priced_lines: { quantity?: number; price_kes?: number | null }[] | null;
  } | null;
}

/**
 * Every payment in one status, OLDEST FIRST — the queue order. Whoever
 * paid first is checked first.
 */
export async function listPaymentsByStatus(
  status: Extract<PaymentRecordStatus, "claimed" | "cash_due">,
): Promise<QueuedPayment[]> {
  const db = getSupabaseServiceRoleClient();
  const { data, error } = await db
    .from("payments")
    .select(
      "id, stream, method, destination, status, amount_kes, mpesa_code, claimed_at, " +
        "bookings(ref, customer_name, phone), orders(ref, customer_name, phone), " +
        "quote_requests(ref, customer_name, phone, priced_lines)",
    )
    .eq("business_id", BUSINESS_ID)
    .eq("status", status)
    .order("claimed_at", { ascending: true });

  if (error) throw new Error(`listPaymentsByStatus: ${error.message}`);

  return (data as unknown as QueueRow[]).map((row) => {
    const parent = row.bookings ?? row.orders ?? row.quote_requests;
    const kind = row.bookings ? "booking" : row.orders ? "order" : "carpet";
    const unpricedPieces = (row.quote_requests?.priced_lines ?? [])
      .filter((line) => line.price_kes === null || line.price_kes === undefined)
      .reduce((total, line) => total + (line.quantity ?? 0), 0);
    return {
      id: row.id,
      stream: row.stream,
      method: row.method,
      destination: row.destination,
      status: row.status,
      amountKes: row.amount_kes,
      mpesaCode: row.mpesa_code,
      claimedAt: toIso(row.claimed_at),
      kind,
      ref: parent?.ref ?? "",
      customerName: parent?.customer_name ?? "",
      phone: parent?.phone ?? "",
      unpricedPieces,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Moving one — through the database function only                     */
/* ------------------------------------------------------------------ */

export type ResolveAction = "verify" | "reject" | "cash_received";

export type ResolvePaymentResult =
  | { ok: true; receiptNumber: string | null }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "conflict"; detail: string }
  | { ok: false; reason: "db_error"; detail: string };

/**
 * Verify, reject or record cash, by calling `resolve_payment()`.
 *
 * One RPC, so one transaction: the status, the parent's mirror, the audit
 * row and the receipt either all happen or none do. `by` is the
 * self-reported "Acting as" name.
 */
export async function resolvePayment(
  paymentId: string,
  action: ResolveAction,
  by: string,
  options: { reason?: string; amountReceivedKes?: number } = {},
): Promise<ResolvePaymentResult> {
  const db = getSupabaseServiceRoleClient();
  const { data, error } = await db.rpc("resolve_payment", {
    p_payment_id: paymentId,
    p_action: action,
    p_by: by,
    p_reason: options.reason ?? null,
    p_amount_received: options.amountReceivedKes ?? null,
  });

  if (error) {
    // P0002: no such payment. P0001: the function refused (already
    // resolved, no reason given) — a state the staff screen can explain.
    if (error.code === "P0002") return { ok: false, reason: "not_found" };
    if (error.code === "P0001") return { ok: false, reason: "conflict", detail: error.message };
    return { ok: false, reason: "db_error", detail: error.message };
  }

  // A rejection returns null; anything else returns the receipt row.
  const receipt = data as { number?: string } | null;
  return { ok: true, receiptNumber: receipt?.number ?? null };
}

/* ------------------------------------------------------------------ */
/* Receipts                                                            */
/* ------------------------------------------------------------------ */

const RECEIPT_SELECT =
  "id, number, series, seq, status, issued_at, issued_by, amount_kes, method, " +
  "mpesa_code, voided_at, voided_by, void_reason, snapshot";

interface ReceiptRow {
  id: string;
  number: string;
  series: "W" | "C";
  seq: number;
  status: ReceiptStatus;
  issued_at: string;
  issued_by: string;
  amount_kes: number;
  method: PaymentMethod;
  mpesa_code: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  snapshot: ReceiptSnapshot;
}

function toReceipt(row: ReceiptRow): ReceiptRecord {
  return {
    id: row.id,
    number: row.number,
    series: row.series,
    seq: row.seq,
    status: row.status,
    issuedAt: toIso(row.issued_at),
    issuedBy: row.issued_by,
    amountKes: row.amount_kes,
    method: row.method,
    mpesaCode: row.mpesa_code,
    voidedAt: row.voided_at ? toIso(row.voided_at) : null,
    voidedBy: row.voided_by,
    voidReason: row.void_reason,
    snapshot: row.snapshot,
  };
}

/**
 * Every receipt, newest first. The ledger filters in the browser: a yard
 * issues a handful a day, and the gap check needs every number in a series
 * anyway, so one read of the lot is both simpler and what the check needs.
 */
export async function listReceipts(): Promise<ReceiptRecord[]> {
  const db = getSupabaseServiceRoleClient();
  const { data, error } = await db
    .from("receipts")
    .select(RECEIPT_SELECT)
    .eq("business_id", BUSINESS_ID)
    .order("issued_at", { ascending: false });
  if (error) throw new Error(`listReceipts: ${error.message}`);
  return (data as unknown as ReceiptRow[]).map(toReceipt);
}

export async function getReceiptByNumber(number: string): Promise<ReceiptRecord | null> {
  const db = getSupabaseServiceRoleClient();
  const { data, error } = await db
    .from("receipts")
    .select(RECEIPT_SELECT)
    .eq("business_id", BUSINESS_ID)
    .eq("number", number)
    .maybeSingle();
  if (error) throw new Error(`getReceiptByNumber: ${error.message}`);
  return data ? toReceipt(data as unknown as ReceiptRow) : null;
}

export type VoidReceiptResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "db_error"; detail: string };

/**
 * Marks a receipt void. The number stays used and is never reissued; the
 * trigger on `receipts` refuses any other change, and refuses a second
 * void. Only `issued` rows match, so voiding twice is `not_found`.
 */
export async function voidReceipt(
  number: string,
  by: string,
  reason: string,
): Promise<VoidReceiptResult> {
  const db = getSupabaseServiceRoleClient();
  const { data, error } = await db
    .from("receipts")
    .update({
      status: "void",
      voided_at: new Date().toISOString(),
      voided_by: by, // from the staff session
      void_reason: reason.trim(),
    })
    .eq("business_id", BUSINESS_ID)
    .eq("number", number)
    .eq("status", "issued")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, reason: "db_error", detail: error.message };
  if (!data) return { ok: false, reason: "not_found" };
  return { ok: true };
}
