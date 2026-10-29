"use client";

/**
 * =====================================================================
 * THE RECEIPTS LEDGER — every number issued, and whether any are missing.
 * ---------------------------------------------------------------------
 * Newest first. Filters for series, dates, method and status; a search
 * that matches the receipt number, the M-Pesa code or the record's
 * reference. Everything is filtered here in the browser from one read of
 * the whole ledger (see `listReceipts`): a yard issues a handful a day.
 *
 * THE TOTALS BAR adds up what the filters show, VOIDED EXCLUDED, split the
 * way the money arrives — cash, till, paybill — so each figure can be held
 * against its own statement.
 *
 * THE INTEGRITY LINE is computed from ALL receipts, not the filtered view:
 * "W-000001 to W-000123, no gaps". The database is built so a gap cannot
 * happen (see `issue_receipt()`); this line is how anyone would notice if
 * one ever did, and it turns red with the missing numbers. Voided receipts
 * still count as present — a void keeps its number.
 *
 * VOID needs a reason and cannot be undone. It does not reopen the
 * payment.
 *
 * EXPORT CSV writes the filtered rows to a file in the browser. No
 * dependency: it is a string and a Blob.
 * =====================================================================
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatKes, formatTimestamp, toDateKey } from "@/lib/format";
import { channelLabel } from "@/lib/payments";
import { receiptPath } from "@/lib/receipt";
import { csvCell } from "@/lib/csv";
import { postStaff, type StaffList } from "@/lib/use-staff-list";
import type { ReceiptRecord } from "@/types";

const th =
  "whitespace-nowrap px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slab-400";
const td = "px-3 py-2.5 align-top text-sm";
const control =
  "min-h-9 rounded-slab border-2 border-slab-300 bg-white px-2 text-sm focus:border-slab-900 focus:outline-none";
const label = "text-xs font-bold uppercase tracking-wide text-slab-500";
const smallButton =
  "min-h-9 whitespace-nowrap rounded-slab border-2 px-2.5 text-xs font-bold uppercase tracking-wide transition-colors duration-150 ease-plain disabled:cursor-not-allowed disabled:opacity-50";

type Channel = "Cash" | "Till" | "Paybill";

function channelOf(receipt: ReceiptRecord): Channel {
  return channelLabel(receipt.method, receipt.snapshot.destination) as Channel;
}

const KIND_ROUTE = { booking: "booking", order: "order", carpet: "carpet" } as const;

/**
 * "W-000001 to W-000123, no gaps", or the missing numbers. From every
 * receipt in the series, whatever the filters say.
 */
function integrity(receipts: ReceiptRecord[], series: "W" | "C") {
  const seqs = receipts
    .filter((receipt) => receipt.series === series)
    .map((receipt) => receipt.seq)
    .sort((a, b) => a - b);
  if (seqs.length === 0) return { text: `${series}: none issued yet`, ok: true };
  const label = (seq: number) => `${series}-${String(seq).padStart(6, "0")}`;
  const present = new Set(seqs);
  const missing: number[] = [];
  // From 1, not from the lowest present: a series that starts at 3 has lost two.
  for (let seq = 1; seq <= seqs[seqs.length - 1]; seq += 1) {
    if (!present.has(seq)) missing.push(seq);
  }
  const range = `${label(1)} to ${label(seqs[seqs.length - 1])}`;
  if (missing.length === 0) return { text: `${range}, no gaps`, ok: true };
  const shown = missing.slice(0, 10).map(label).join(", ");
  return {
    text: `${range}: MISSING ${shown}${missing.length > 10 ? ` and ${missing.length - 10} more` : ""}`,
    ok: false,
  };
}

/**
 * Every cell goes through `csvCell` (src/lib/csv.ts): quoted, and with a
 * leading apostrophe on anything a spreadsheet would run as a formula. The
 * customer name comes straight from a public form.
 *
 * The staff names are labelled self-reported in the header itself, so the
 * caveat travels with the file.
 *
 * `source` is "online" or "walk-in" for a wash booking, blank otherwise.
 * `plate` is the booking's vehicle field: the plate staff typed for a
 * walk-in, the customer's own "make, model and plate" for an online one.
 */
function toCsv(rows: ReceiptRecord[]): string {
  const header = [
    "number", "issued_at", "series", "ref", "customer", "phone", "method",
    "amount_kes", "mpesa_code", "issued_by (self-reported)", "status", "void_reason",
    "voided_by (self-reported)", "source", "plate",
  ];
  const quote = csvCell;
  const lines = rows.map((receipt) =>
    [
      receipt.number,
      receipt.issuedAt,
      receipt.series,
      receipt.snapshot.ref,
      receipt.snapshot.customer_name,
      receipt.snapshot.phone,
      channelOf(receipt),
      receipt.amountKes,
      receipt.mpesaCode,
      receipt.issuedBy,
      receipt.status,
      receipt.voidReason,
      receipt.voidedBy,
      receipt.snapshot.kind === "booking"
        ? receipt.source === "staff"
          ? "walk-in"
          : "online"
        : "",
      receipt.snapshot.kind === "booking" ? (receipt.snapshot.vehicle ?? "") : "",
    ]
      .map(quote)
      .join(","),
  );
  return [header.map(quote).join(","), ...lines].join("\r\n");
}

export function ReceiptsLedger({
  list,
  onChanged,
}: {
  list: StaffList<ReceiptRecord>;
  onChanged: () => void;
}) {
  const [series, setSeries] = useState<"all" | "W" | "C">("all");
  const [channel, setChannel] = useState<"all" | Channel>("all");
  const [status, setStatus] = useState<"all" | "issued" | "void">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [voiding, setVoiding] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const receipts = list.items;

  const shown = useMemo(() => {
    const needle = query.trim().toUpperCase().replace(/\s+/g, "");
    return receipts.filter((receipt) => {
      if (series !== "all" && receipt.series !== series) return false;
      if (channel !== "all" && channelOf(receipt) !== channel) return false;
      if (status !== "all" && receipt.status !== status) return false;
      const day = toDateKey(new Date(receipt.issuedAt));
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (needle) {
        const hay = `${receipt.number} ${receipt.mpesaCode ?? ""} ${receipt.snapshot.ref}`
          .toUpperCase()
          .replace(/\s+/g, "");
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [receipts, series, channel, status, from, to, query]);

  // Voided receipts are shown in the table but never counted as money.
  const totals = useMemo(() => {
    const live = shown.filter((receipt) => receipt.status === "issued");
    const sum = (which: Channel) =>
      live.filter((receipt) => channelOf(receipt) === which).reduce((t, r) => t + r.amountKes, 0);
    return {
      count: live.length,
      voided: shown.length - live.length,
      cash: sum("Cash"),
      till: sum("Till"),
      paybill: sum("Paybill"),
      all: live.reduce((t, r) => t + r.amountKes, 0),
    };
  }, [shown]);

  const checks = [integrity(receipts, "W"), integrity(receipts, "C")];

  async function confirmVoid(receipt: ReceiptRecord) {
    if (!reason.trim()) return;
    setBusy(true);
    setMessage(null);
    const result = await postStaff(`/api/receipts/${encodeURIComponent(receipt.number)}/void`, {
      reason: reason.trim(),
    });
    setBusy(false);
    setVoiding(null);
    setReason("");
    setMessage(
      result.ok
        ? { text: `${receipt.number} voided. The number stays used.`, ok: true }
        : {
            text:
              typeof result.data.detail === "string"
                ? result.data.detail
                : "That did not save. Nothing changed — try again.",
            ok: false,
          },
    );
    await list.refresh();
    onChanged();
  }

  function exportCsv() {
    const blob = new Blob([toCsv(shown)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `receipts-${toDateKey(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* ---- integrity, from the whole ledger ---- */}
      <ul className="mb-4 flex flex-col gap-1">
        {checks.map((check) => (
          <li
            key={check.text}
            className={`text-sm font-semibold ${check.ok ? "text-ok" : "text-alert"}`}
          >
            {check.text}
          </li>
        ))}
      </ul>

      {/* ---- filters ---- */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="flex flex-col gap-1">
          <span className={label}>Series</span>
          <select className={control} value={series} onChange={(e) => setSeries(e.target.value as typeof series)}>
            <option value="all">All</option>
            <option value="W">W (wash, carpets)</option>
            <option value="C">C (concrete)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Method</span>
          <select className={control} value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
            <option value="all">All</option>
            <option value="Cash">Cash</option>
            <option value="Till">Till</option>
            <option value="Paybill">Paybill</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Status</span>
          <select className={control} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">All</option>
            <option value="issued">Issued</option>
            <option value="void">Void</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>From</span>
          <input type="date" className={control} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>To</span>
          <input type="date" className={control} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Search</span>
          <input
            type="search"
            className={control}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Number, code or ref"
          />
        </label>
      </div>

      {/* ---- totals for what the filters show, voided excluded ---- */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-slab border-2 border-slab-900 bg-white px-4 py-3 text-sm">
        <span className="font-bold">
          {totals.count} receipt{totals.count === 1 ? "" : "s"} · {formatKes(totals.all)}
        </span>
        <span>Cash {formatKes(totals.cash)}</span>
        <span>Till {formatKes(totals.till)}</span>
        <span>Paybill {formatKes(totals.paybill)}</span>
        {totals.voided > 0 ? (
          <span className="text-slab-500">{totals.voided} void, not counted</span>
        ) : null}
        <button
          type="button"
          onClick={exportCsv}
          disabled={shown.length === 0}
          className={`${smallButton} ml-auto border-slab-300 text-slab-700 hover:border-slab-900 hover:text-slab-900`}
        >
          Export CSV
        </button>
      </div>

      {message ? (
        <p
          role={message.ok ? "status" : "alert"}
          className={`mb-3 rounded-slab border-2 px-3 py-2 text-sm text-slab-800 ${
            message.ok ? "border-ok/40 bg-ok-tint" : "border-fail bg-fail-tint"
          }`}
        >
          {message.text}
        </p>
      ) : null}
      {list.error ? (
        <p className="mb-3 rounded-slab border-2 border-fail bg-fail-tint px-3 py-2 text-sm text-slab-800">
          {list.error}
        </p>
      ) : null}

      {list.loading ? (
        <p className="text-sm text-slab-500">Loading receipts...</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-slab-600">
          {receipts.length === 0
            ? "No receipts issued yet. One is issued when you verify a code or record cash."
            : "No receipts match these filters."}
        </p>
      ) : (
        <div className="p-3 md:overflow-x-auto md:p-0">
          <table className="record-table w-full border-collapse md:min-w-[56rem]">
            <thead className="bg-slab-900">
              <tr>
                <th className={th}>Number</th>
                <th className={th}>Ref</th>
                <th className={th}>Customer</th>
                <th className={th}>Method</th>
                <th className={th}>Amount</th>
                <th className={th}>
                  Issued by <span className="font-normal normal-case">(self-reported)</span>
                </th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody className="md:divide-y-2 md:divide-slab-100">
              {shown.map((receipt) => {
                const isVoid = receipt.status === "void";
                return (
                  <tr key={receipt.id} className={isVoid ? "text-slab-400" : ""}>
                    <td className={`${td} md:whitespace-nowrap`} data-head="">
                      <span className={`font-mono font-bold ${isVoid ? "line-through" : ""}`}>
                        {receipt.number}
                      </span>
                      <span className="mt-0.5 block text-xs text-slab-500">
                        {formatTimestamp(receipt.issuedAt)}
                      </span>
                    </td>
                    <td className={`${td} md:whitespace-nowrap`} data-label="Ref">
                      <Link
                        href={receiptPath(KIND_ROUTE[receipt.snapshot.kind], receipt.snapshot.ref)}
                        target="_blank"
                        rel="noopener"
                        className="font-mono text-xs underline underline-offset-4"
                      >
                        {receipt.snapshot.ref}
                      </Link>
                    </td>
                    <td className={td} data-label="Customer">
                      {receipt.snapshot.customer_name}
                    </td>
                    <td className={`${td} md:whitespace-nowrap`} data-label="Method">
                      {channelOf(receipt)}
                      {receipt.mpesaCode ? (
                        <span className="mt-0.5 block font-mono text-xs">{receipt.mpesaCode}</span>
                      ) : null}
                    </td>
                    <td className={`${td} font-bold md:whitespace-nowrap`} data-label="Amount">
                      {formatKes(receipt.amountKes)}
                      {receipt.snapshot.amount_differs ? (
                        <span className="mt-0.5 block text-xs font-semibold text-alert">
                          expected {formatKes(receipt.snapshot.expected_kes)}
                        </span>
                      ) : null}
                    </td>
                    <td className={td} data-label="Issued by (self-reported)">
                      {receipt.issuedBy}
                    </td>
                    <td className={td} data-label="Status">
                      {isVoid ? (
                        <span className="text-xs">
                          <span className="font-bold uppercase">Void</span>
                          {receipt.voidReason ? ` — ${receipt.voidReason}` : ""}
                          {receipt.voidedBy ? ` (${receipt.voidedBy}, self-reported)` : ""}
                        </span>
                      ) : voiding === receipt.id ? (
                        <div className="flex flex-col gap-2">
                          <label className="sr-only" htmlFor={`void-${receipt.id}`}>
                            Reason for voiding {receipt.number}
                          </label>
                          <input
                            id={`void-${receipt.id}`}
                            className={control}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Reason (required)"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={busy || !reason.trim()}
                              onClick={() => confirmVoid(receipt)}
                              className={`${smallButton} border-alert bg-alert text-white`}
                            >
                              Void
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setVoiding(null);
                                setReason("");
                              }}
                              className={`${smallButton} border-slab-300 text-slab-700`}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-xs font-bold uppercase text-ok">Issued</span>
                          <button
                            type="button"
                            onClick={() => {
                              setReason("");
                              setVoiding(receipt.id);
                            }}
                            className="text-xs font-bold uppercase tracking-wide text-slab-500 underline underline-offset-4 hover:text-slab-900"
                          >
                            Void
                          </button>
                        </div>
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
