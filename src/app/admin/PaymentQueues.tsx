"use client";

/**
 * =====================================================================
 * THE TWO PAYMENT QUEUES — codes to verify, cash to take.
 * ---------------------------------------------------------------------
 * The only places in the staff view where a payment moves, and so the
 * only places a receipt number is issued. Every action here goes to
 * /api/payments/[id], which calls `resolve_payment()` in the database:
 * the status, the audit row and the receipt happen together or not at all.
 *
 * A NUMBER IS ISSUED THE MOMENT YOU CONFIRM, AND IS NEVER TAKEN BACK. So
 * Verify and Cash received are two clicks — the button, then "Yes, issue
 * receipt" — and the reminder to check the statement sits right above the
 * list rather than in a help page. A mistaken receipt can be voided in the
 * ledger, but its number stays used.
 *
 * Oldest first. Whoever paid first is checked first.
 *
 * Who resolved it is stamped by the server from the staff session (the
 * first name typed at sign-in, self-reported); this page sends no name.
 * =====================================================================
 */

import { useState } from "react";
import { formatKes, formatTimestamp } from "@/lib/format";
import { channelLabel } from "@/lib/payments";
import type { QueuedPayment } from "@/lib/payments-db";
import { postStaff, type StaffList } from "@/lib/use-staff-list";

const th =
  "whitespace-nowrap px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slab-400";
const td = "px-3 py-2.5 align-top text-sm";
const smallButton =
  "min-h-9 whitespace-nowrap rounded-slab border-2 px-2.5 text-xs font-bold uppercase tracking-wide transition-colors duration-150 ease-plain disabled:cursor-not-allowed disabled:opacity-50";
const quietButton = `${smallButton} border-slab-300 text-slab-700 hover:border-slab-900 hover:text-slab-900`;
const strongButton = `${smallButton} border-slab-900 bg-slab-900 text-slab-50 hover:bg-slab-700`;

const KIND_WORDS = { booking: "Wash booking", order: "Concrete order", carpet: "Carpets / sofa" } as const;

/** The record a payment belongs to, linked to its receipt route. */
function RefCell({ payment }: { payment: QueuedPayment }) {
  return (
    <td className={`${td} md:whitespace-nowrap`} data-head="">
      <span className="font-mono text-xs font-bold">{payment.ref}</span>
      <span className="mt-0.5 block text-xs text-slab-500">{KIND_WORDS[payment.kind]}</span>
      <span className="mt-0.5 block text-xs text-slab-400">{formatTimestamp(payment.claimedAt)}</span>
    </td>
  );
}

/**
 * `prominent` is for the verify queue, where the phone is evidence: the
 * statement shows the payer's name and part of their number, and that has
 * to be matched against THIS booking before a receipt is issued.
 */
function CustomerCell({ payment, prominent = false }: { payment: QueuedPayment; prominent?: boolean }) {
  return (
    <td className={td} data-label="Customer">
      <span className="font-semibold">{payment.customerName}</span>
      <a
        href={`tel:${payment.phone.replace(/\s/g, "")}`}
        className={`mt-0.5 block underline underline-offset-4 hover:text-slab-600 ${
          prominent ? "font-mono text-base font-bold text-slab-900" : "text-xs"
        }`}
      >
        {payment.phone}
      </a>
    </td>
  );
}

function Message({ text, tone }: { text: string; tone: "fail" | "ok" }) {
  return (
    <p
      role={tone === "fail" ? "alert" : "status"}
      className={`mb-3 rounded-slab border-2 px-3 py-2 text-sm text-slab-800 ${
        tone === "fail" ? "border-fail bg-fail-tint" : "border-ok/40 bg-ok-tint"
      }`}
    >
      {text}
    </p>
  );
}

function describeFailure(status: number, data: Record<string, unknown>): string {
  if (status === 401) return "Your session has expired. Reload to sign in again.";
  if (typeof data.detail === "string") return data.detail;
  return "That did not save. Nothing changed — try again.";
}

/* ------------------------------------------------------------------ */
/* Payments to verify                                                  */
/* ------------------------------------------------------------------ */

export function PaymentsToVerify({
  list,
  onChanged,
}: {
  list: StaffList<QueuedPayment>;
  /** Reloads the sections an action touches (bookings, orders, ledger). */
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ text: string; tone: "fail" | "ok" } | null>(null);

  async function act(payment: QueuedPayment, action: "verify" | "reject") {
    if (action === "reject" && !reason.trim()) {
      setMessage({ text: "Say why it is being rejected.", tone: "fail" });
      return;
    }
    setBusy(payment.id);
    setMessage(null);
    const result = await postStaff(`/api/payments/${payment.id}`, {
      action,
      ...(action === "reject" ? { reason: reason.trim() } : {}),
    });
    setBusy(null);
    setConfirming(null);
    setRejecting(null);
    setReason("");
    if (!result.ok) {
      setMessage({ text: describeFailure(result.status, result.data), tone: "fail" });
    } else {
      setMessage({
        text:
          action === "verify"
            ? `${payment.ref} verified. Receipt ${String(result.data.receiptNumber ?? "")} issued.`
            : `${payment.ref} rejected. Phone ${payment.customerName} on ${payment.phone}.`,
        tone: "ok",
      });
    }
    await list.refresh();
    onChanged();
  }

  return (
    <div>
      <p className="mb-3 rounded-slab border-2 border-hivis bg-hivis-tint px-3 py-2 text-sm font-semibold text-slab-800">
        Match the code, the amount AND the payer&rsquo;s name or visible phone digits on the
        statement to this booking&rsquo;s phone before verifying. A code alone can be copied
        from someone else&rsquo;s SMS.
      </p>
      {message ? <Message {...message} /> : null}
      {list.error ? <Message text={list.error} tone="fail" /> : null}

      {list.loading ? (
        <p className="text-sm text-slab-500">Loading payments...</p>
      ) : list.items.length === 0 ? (
        <p className="text-sm text-slab-600">No M-Pesa codes waiting to be checked.</p>
      ) : (
        <div className="p-3 md:overflow-x-auto md:p-0">
          <table className="record-table w-full border-collapse md:min-w-[46rem]">
            <thead className="bg-slab-900">
              <tr>
                <th className={th}>Ref</th>
                <th className={th}>Customer</th>
                <th className={th}>Expected</th>
                <th className={th}>M-Pesa code</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="md:divide-y-2 md:divide-slab-100">
              {list.items.map((payment) => (
                <tr key={payment.id}>
                  <RefCell payment={payment} />
                  <CustomerCell payment={payment} prominent />
                  <td className={`${td} md:whitespace-nowrap`} data-label="Expected">
                    <span className="font-bold">{formatKes(payment.amountKes)}</span>
                    <span className="mt-0.5 block text-xs text-slab-500">
                      {channelLabel(payment.method, payment.destination)}
                    </span>
                  </td>
                  <td className={td} data-label="M-Pesa code">
                    <span className="font-mono text-base font-bold">{payment.mpesaCode}</span>
                  </td>
                  <td className={td} data-label="">
                    {rejecting === payment.id ? (
                      <div className="flex flex-col gap-2">
                        <label className="sr-only" htmlFor={`reason-${payment.id}`}>
                          Reason for rejecting {payment.ref}
                        </label>
                        <input
                          id={`reason-${payment.id}`}
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder="Reason (required)"
                          className="min-h-9 rounded-slab border-2 border-slab-300 px-2 text-sm focus:border-slab-900 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={strongButton}
                            disabled={busy !== null || !reason.trim()}
                            onClick={() => act(payment, "reject")}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            className={quietButton}
                            onClick={() => {
                              setRejecting(null);
                              setReason("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : confirming === payment.id ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={strongButton}
                          disabled={busy !== null}
                          onClick={() => act(payment, "verify")}
                        >
                          {busy === payment.id ? "Issuing..." : "Yes, issue receipt"}
                        </button>
                        <button type="button" className={quietButton} onClick={() => setConfirming(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={strongButton}
                          disabled={busy !== null}
                          onClick={() => {
                            setRejecting(null);
                            setConfirming(payment.id);
                          }}
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          className={quietButton}
                          disabled={busy !== null}
                          onClick={() => {
                            setConfirming(null);
                            setReason("");
                            setRejecting(payment.id);
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cash due                                                            */
/* ------------------------------------------------------------------ */

export function CashDue({
  list,
  onChanged,
}: {
  list: StaffList<QueuedPayment>;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  // Per-row amount as typed. Absent means "the expected total".
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ text: string; tone: "fail" | "ok" } | null>(null);

  function amountFor(payment: QueuedPayment): string {
    return amounts[payment.id] ?? String(payment.amountKes);
  }

  async function receive(payment: QueuedPayment) {
    const typed = amountFor(payment).trim();
    const amount = Number(typed);
    if (!/^\d+$/.test(typed) || !Number.isSafeInteger(amount)) {
      setMessage({ text: "Enter the amount received in whole shillings.", tone: "fail" });
      return;
    }
    setBusy(payment.id);
    setMessage(null);
    const result = await postStaff(`/api/payments/${payment.id}`, {
      action: "cash_received",
      amountReceivedKes: amount,
    });
    setBusy(null);
    setConfirming(null);
    if (!result.ok) {
      setMessage({ text: describeFailure(result.status, result.data), tone: "fail" });
    } else {
      setMessage({
        text: `${payment.ref}: ${formatKes(amount)} cash received. Receipt ${String(result.data.receiptNumber ?? "")} issued.`,
        tone: "ok",
      });
    }
    await list.refresh();
    onChanged();
  }

  return (
    <div>
      {message ? <Message {...message} /> : null}
      {list.error ? <Message text={list.error} tone="fail" /> : null}

      {list.loading ? (
        <p className="text-sm text-slab-500">Loading cash due...</p>
      ) : list.items.length === 0 ? (
        <p className="text-sm text-slab-600">No cash payments waiting.</p>
      ) : (
        <div className="p-3 md:overflow-x-auto md:p-0">
          <table className="record-table w-full border-collapse md:min-w-[46rem]">
            <thead className="bg-slab-900">
              <tr>
                <th className={th}>Ref</th>
                <th className={th}>Customer</th>
                <th className={th}>Expected</th>
                <th className={th}>Received</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="md:divide-y-2 md:divide-slab-100">
              {list.items.map((payment) => {
                const typed = amountFor(payment);
                const differs = typed.trim() !== "" && Number(typed) !== payment.amountKes;
                return (
                  <tr key={payment.id}>
                    <RefCell payment={payment} />
                    <CustomerCell payment={payment} />
                    <td className={`${td} md:whitespace-nowrap`} data-label="Expected">
                      <span className="font-bold">{formatKes(payment.amountKes)}</span>
                      {payment.unpricedPieces > 0 ? (
                        <span className="mt-0.5 block max-w-44 whitespace-normal text-xs text-slab-600">
                          Plus {payment.unpricedPieces} piece
                          {payment.unpricedPieces === 1 ? "" : "s"} with no listed price — agree the
                          price and enter the full amount taken.
                        </span>
                      ) : null}
                    </td>
                    <td className={td} data-label="Received">
                      <label className="sr-only" htmlFor={`cash-${payment.id}`}>
                        Amount received for {payment.ref}
                      </label>
                      <input
                        id={`cash-${payment.id}`}
                        inputMode="numeric"
                        value={typed}
                        onChange={(event) =>
                          setAmounts((current) => ({ ...current, [payment.id]: event.target.value }))
                        }
                        className="min-h-9 w-28 rounded-slab border-2 border-slab-300 px-2 text-sm font-semibold focus:border-slab-900 focus:outline-none"
                      />
                      {differs ? (
                        <span className="mt-1 block text-xs font-semibold text-alert">
                          Differs from expected — noted on the receipt.
                        </span>
                      ) : null}
                    </td>
                    <td className={td} data-label="">
                      {confirming === payment.id ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={strongButton}
                            disabled={busy !== null}
                            onClick={() => receive(payment)}
                          >
                            {busy === payment.id ? "Issuing..." : "Yes, issue receipt"}
                          </button>
                          <button type="button" className={quietButton} onClick={() => setConfirming(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={strongButton}
                          disabled={busy !== null}
                          onClick={() => setConfirming(payment.id)}
                        >
                          Cash received
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
