import { ButtonLink } from "@/components/Button";
import { PaymentBadge } from "@/components/Badge";
import { formatKes } from "@/lib/format";
import { hasOfficialReceipt } from "@/lib/payments";
import type { PaymentStatus, PaymentSummary } from "@/types";

/**
 * =====================================================================
 * WHERE THE PAYMENT STANDS — the block on every confirmation page.
 * ---------------------------------------------------------------------
 * No hooks, so it renders on the server with the record.
 *
 * THE RULE IT EXISTS TO KEEP: no receipt number, no "Paid" and no
 * printable receipt until staff have confirmed the money. A customer who
 * has just typed an M-Pesa code sees "Payment pending verification" and
 * the code they typed, not a tick; somebody paying cash sees "Pay cash at
 * the yard". The receipt link appears only once a receipt exists.
 * =====================================================================
 */

const CASH_WORDS = {
  wash: "Pay when you bring your vehicle.",
  carpet: "Pay when you bring them in.",
  concrete: "Pay when you collect from the yard.",
} as const;

export function PaymentStatusNotice({
  payment,
  legacyStatus,
  context,
  receiptHref,
}: {
  payment: PaymentSummary | undefined;
  /** The old status, for a record made before payments were recorded. */
  legacyStatus?: PaymentStatus;
  context: keyof typeof CASH_WORDS;
  receiptHref: string;
}) {
  if (!payment) {
    return legacyStatus ? (
      <p className="flex items-center gap-2 text-sm">
        Payment <PaymentBadge status={legacyStatus} />
      </p>
    ) : null;
  }

  if (hasOfficialReceipt(payment) && payment.receipt) {
    const isVoid = payment.receipt.status === "void";
    return (
      <div className="rounded-slab border-2 border-ok/40 bg-ok-tint px-4 py-3">
        <p className="text-sm font-bold uppercase tracking-wide text-ok">
          {isVoid ? "Receipt voided" : "Paid"}
        </p>
        <p className="mt-1 text-sm text-slab-800">
          Receipt{" "}
          <span className="font-mono font-bold">{payment.receipt.number}</span>
          {isVoid ? " (VOID)" : ""} —{" "}
          {formatKes(payment.amountReceivedKes ?? payment.amountKes)}
        </p>
        <ButtonLink href={receiptHref} size="md" className="mt-3">
          View / print receipt
        </ButtonLink>
      </div>
    );
  }

  if (payment.status === "claimed") {
    return (
      <div className="rounded-slab border-2 border-hivis bg-hivis-tint px-4 py-3">
        <p className="text-sm font-bold uppercase tracking-wide text-slab-800">
          Payment pending verification
        </p>
        <p className="mt-1 text-sm text-slab-800">
          We will check M-Pesa code{" "}
          <span className="font-mono font-bold">{payment.mpesaCode}</span> for{" "}
          {formatKes(payment.amountKes)} against our statement. Your receipt is
          issued once it is confirmed.
        </p>
      </div>
    );
  }

  if (payment.status === "rejected") {
    return (
      <div className="rounded-slab border-2 border-alert bg-alert-tint px-4 py-3">
        <p className="text-sm font-bold uppercase tracking-wide text-alert">
          Payment not matched
        </p>
        <p className="mt-1 text-sm text-slab-800">
          We could not match your M-Pesa payment. The yard will call you to
          sort it out.
        </p>
      </div>
    );
  }

  // cash_due (cash_received without a receipt is not reachable: the
  // database issues the receipt in the same transaction).
  return (
    <div className="rounded-slab border-2 border-slab-300 bg-white px-4 py-3">
      <p className="text-sm font-bold uppercase tracking-wide text-slab-800">
        Pay cash at the yard
      </p>
      <p className="mt-1 text-sm text-slab-700">
        {formatKes(payment.amountKes)}. {CASH_WORDS[context]}
      </p>
    </div>
  );
}
