import { OfficialReceipt, PendingReceipt } from "@/components/Receipt";
import { hasOfficialReceipt } from "@/lib/payments";
import { getReceiptByNumber } from "@/lib/payments-db";
import type { PaymentSummary } from "@/types";

/**
 * The official receipt for a record, or the "no receipt yet" page.
 *
 * Shared by /receipt/booking, /receipt/order and /receipt/carpet. A
 * receipt is shown only when the record's payment is settled AND a
 * receipt row exists for it; the row is then read in full so the page is
 * rendered from its frozen snapshot rather than from the live record.
 */
export async function ReceiptFor({
  reference,
  payment,
  backHref,
}: {
  reference: string;
  payment: PaymentSummary | undefined;
  backHref: string;
}) {
  if (payment && hasOfficialReceipt(payment) && payment.receipt) {
    const receipt = await getReceiptByNumber(payment.receipt.number);
    if (receipt) return <OfficialReceipt receipt={receipt} backHref={backHref} />;
  }
  return <PendingReceipt reference={reference} payment={payment} backHref={backHref} />;
}
