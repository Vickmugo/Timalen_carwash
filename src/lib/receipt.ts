/**
 * =====================================================================
 * RECEIPTS — where they live.
 * ---------------------------------------------------------------------
 * Small on purpose: the URL shape is needed by the confirmation pages, the
 * carpet form, the staff view and the receipt routes, and a URL written
 * out in four places is eventually written four different ways.
 *
 * WHETHER A RECORD HAS A RECEIPT is no longer a rule about its status. It
 * has one when the database has issued one — at the moment staff verified
 * the M-Pesa code or took the cash — and not before. Read it off the
 * record's payment (`hasOfficialReceipt` in src/lib/payments.ts); the old
 * `canIssueReceipt(status)` guess is gone.
 * =====================================================================
 */

/**
 * Concrete quote requests are absent by design: a quote is a question with
 * nothing owed. Carpet requests are here because they are paid for.
 */
export type ReceiptKind = "booking" | "order" | "carpet";

/**
 * The record's reference is the URL segment, verbatim — WB-4K9T2X stays
 * WB-4K9T2X — encoded anyway, because a ref typed by hand into the address
 * bar is not guaranteed to be one of ours.
 */
export function receiptPath(kind: ReceiptKind, ref: string): string {
  return `/receipt/${kind}/${encodeURIComponent(ref)}`;
}
