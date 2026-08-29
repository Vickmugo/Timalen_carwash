import type { FulfilmentStatus, PaymentStatus, QuoteStatus } from "@/types";

const shell =
  "inline-flex items-center rounded-slab border px-2 py-0.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap";

export function FulfilmentBadge({ status }: { status: FulfilmentStatus }) {
  const isReady = status === "ready_to_ship";
  return (
    <span
      className={`${shell} ${
        isReady
          ? "border-ok/30 bg-ok-tint text-ok"
          : "border-slab-300 bg-slab-100 text-slab-600"
      }`}
    >
      {isReady ? "In the yard" : "Made to order"}
    </span>
  );
}

const paymentLabels: Record<PaymentStatus, string> = {
  paid: "Paid",
  pay_on_collection: "Pay on arrival",
  unpaid: "Unpaid",
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const tone =
    status === "paid"
      ? "border-ok/30 bg-ok-tint text-ok"
      : status === "pay_on_collection"
        ? "border-hivis/40 bg-hivis-tint text-slab-800"
        : "border-alert/30 bg-alert-tint text-alert";
  return <span className={`${shell} ${tone}`}>{paymentLabels[status]}</span>;
}

const quoteLabels: Record<QuoteStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  closed: "Closed",
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const tone =
    status === "new"
      ? "border-hivis/40 bg-hivis-tint text-slab-800"
      : status === "closed"
        ? "border-slab-300 bg-slab-100 text-slab-500"
        : "border-ok/30 bg-ok-tint text-ok";
  return <span className={`${shell} ${tone}`}>{quoteLabels[status]}</span>;
}
