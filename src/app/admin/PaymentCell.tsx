"use client";

/**
 * =====================================================================
 * A RECORD'S PAYMENT, IN ONE TABLE CELL — bookings, orders, carpets.
 * ---------------------------------------------------------------------
 * Read-only on purpose. A payment moves in the two queues at the top of
 * the staff view (Payments to verify, Cash due), where the reminder to
 * check the statement sits next to the button. Putting a status select
 * here as well would be a second, unguarded way to say "paid".
 *
 * The receipt number links to the printed receipt and appears only once
 * the database has issued one.
 * =====================================================================
 */

import Link from "next/link";
import { formatKes } from "@/lib/format";
import { channelLabel, paymentRecordLabel } from "@/lib/payments";
import { receiptPath, type ReceiptKind } from "@/lib/receipt";
import type { PaymentRecordStatus, PaymentSummary } from "@/types";

const shell =
  "inline-flex items-center rounded-slab border px-2 py-0.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap";

const tones: Record<PaymentRecordStatus, string> = {
  claimed: "border-hivis/40 bg-hivis-tint text-slab-800",
  cash_due: "border-hivis/40 bg-hivis-tint text-slab-800",
  verified: "border-ok/30 bg-ok-tint text-ok",
  cash_received: "border-ok/30 bg-ok-tint text-ok",
  rejected: "border-alert/30 bg-alert-tint text-alert",
};

export function PaymentRecordBadge({ status }: { status: PaymentRecordStatus }) {
  return <span className={`${shell} ${tones[status]}`}>{paymentRecordLabel(status)}</span>;
}

export function PaymentCell({
  payment,
  kind,
  reference,
}: {
  payment: PaymentSummary;
  kind: ReceiptKind;
  reference: string;
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <PaymentRecordBadge status={payment.status} />
      <span className="text-xs text-slab-500">
        {formatKes(payment.amountReceivedKes ?? payment.amountKes)} ·{" "}
        {channelLabel(payment.method, payment.destination)}
      </span>
      {payment.mpesaCode ? (
        <span className="font-mono text-xs text-slab-600">{payment.mpesaCode}</span>
      ) : null}
      {payment.status === "rejected" && payment.rejectReason ? (
        <span className="text-xs text-alert">{payment.rejectReason}</span>
      ) : null}
      {payment.receipt ? (
        <Link
          href={receiptPath(kind, reference)}
          target="_blank"
          rel="noopener"
          className="whitespace-nowrap font-mono text-xs font-bold text-slab-700 underline underline-offset-4 hover:text-slab-900"
        >
          {payment.receipt.number}
          {payment.receipt.status === "void" ? " (VOID)" : ""}
        </Link>
      ) : null}
    </div>
  );
}
