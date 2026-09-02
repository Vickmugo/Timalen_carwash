/**
 * =====================================================================
 * RECEIPTS — where they live, and which records may have one.
 * ---------------------------------------------------------------------
 * Small on purpose. Both facts below are needed in three places each (the
 * two confirmation pages, the staff view, and the receipt route itself),
 * and a URL shape or an eligibility rule that is written out three times
 * is a rule that will eventually be written three different ways.
 * =====================================================================
 */

import type { PaymentStatus } from "@/types";

/**
 * Quote requests are absent by design. A quote is a question — "what would
 * this cost" — with no agreed price and nothing owed, so there is nothing
 * to receipt. It becomes receiptable when it turns into an order.
 */
export type ReceiptKind = "booking" | "order";

/**
 * The reference codes are used verbatim as the URL segment: WB-4K9T2X
 * stays WB-4K9T2X. No second ID scheme is introduced, because the whole
 * value of the printed reference is that the customer reading it off paper
 * and the staff member searching for it in the staff view are looking at
 * the same string. `makeRef` (src/lib/format.ts) draws from an alphabet
 * with no lookalike characters and no URL-unsafe ones, so this needs no
 * encoding — but it gets encoded anyway, because a ref typed by hand into
 * the address bar is not guaranteed to be one of ours.
 */
export function receiptPath(kind: ReceiptKind, ref: string): string {
  return `/receipt/${kind}/${encodeURIComponent(ref)}`;
}

/**
 * WHETHER A RECORD IS FINISHED ENOUGH TO RECEIPT — used to decide whether
 * the staff view offers the link.
 *
 * Only `paid` qualifies. The other two are both open, in different ways:
 *
 *   unpaid             nothing has been collected
 *   pay_on_collection  nothing has been collected EITHER — the badge reads
 *                      "Pay on arrival", which is an arrangement to pay
 *                      later, not a payment. It is the one that looks like
 *                      it might count, and it does not
 *
 * Handing someone a receipt for money the yard has not received is how a
 * dispute starts, and the staff member clicking the link is the one who
 * would have to argue it. So the link appears when the payment does.
 *
 * This gates the STAFF view only. The customer's own confirmation page
 * links to their receipt whatever the status, because that page is the
 * record of what they booked and the receipt states its payment status
 * plainly — including "Unpaid". A customer being able to print the
 * arrangement they just made is the normal case, not a claim of payment.
 */
export function canIssueReceipt(status: PaymentStatus): boolean {
  return status === "paid";
}
