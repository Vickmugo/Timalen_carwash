import { changeStatusLabel } from "@/lib/change-requests";
import type {
  ChangeRequestStatus,
  FulfilmentStatus,
  PaymentStatus,
  QuoteStatus,
} from "@/types";

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

/**
 * The same wording as the badge, for places that need the words without the
 * coloured pill — printed receipts, most of all, where the badge's tint
 * would not survive a mono printer.
 *
 * Exported so there is ONE spelling of "Pay on arrival" in the project. A
 * receipt and the badge beside it disagreeing about what a status is called
 * is the kind of thing nobody notices until a customer asks.
 */
export function paymentLabel(status: PaymentStatus): string {
  return paymentLabels[status];
}

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

/**
 * The badge's wording without the pill, for the same reason as
 * `paymentLabel` above: the staff view's status filter buttons need these
 * words, and a filter labelled "Contacted" next to badges labelled
 * "contacted" would be two spellings of one status drifting apart.
 */
export function quoteLabel(status: QuoteStatus): string {
  return quoteLabels[status];
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const tone =
    status === "new"
      ? "border-hivis/40 bg-hivis-tint text-slab-800"
      : status === "closed"
        ? "border-slab-300 bg-slab-100 text-slab-500"
        : "border-ok/30 bg-ok-tint text-ok";
  return <span className={`${shell} ${tone}`}>{quoteLabels[status]}</span>;
}

/**
 * DRAFT / SENT, and neither one is good news yet.
 *
 * Draft carries the accent, because a draft is the one with something left
 * to do — it is the same reason a `new` quote is amber. Sent is deliberately
 * NOT the green used for `paid` and `ready_to_ship` elsewhere: green on this
 * page means a thing that is settled, and a sent request is a message
 * somebody put in a chat window. It may not have been read, and nothing on
 * the site has changed because of it. Grey says "off my desk", which is all
 * this status honestly means. See src/types/index.ts.
 */
export function ChangeRequestBadge({ status }: { status: ChangeRequestStatus }) {
  const tone =
    status === "draft"
      ? "border-hivis/40 bg-hivis-tint text-slab-800"
      : "border-slab-300 bg-slab-100 text-slab-600";
  return (
    <span className={`${shell} ${tone}`}>{changeStatusLabel(status)}</span>
  );
}
