"use client";

/**
 * =====================================================================
 * CARPET AND SOFA-SET REQUESTS — the staff list.
 * ---------------------------------------------------------------------
 * READ FROM THE SERVER, unlike the quote requests above it, which still
 * live in the browser that sent them. These come from /book/carpets via
 * /api/carpet-requests, so every staff device sees the same list.
 *
 * READ-ONLY FOR NOW. Every request arrives as `new` and there is no control
 * here to move it on. The payment shows here; it is verified or marked
 * received in the queues at the top of the page. The list is for ringing
 * people back, and the phone number is a link.
 *
 * The Hand-over column prints what each request stored. New requests all
 * say they are brought to the yard; older ones keep the drop-off or
 * collection address the customer gave when the form still asked.
 * =====================================================================
 */

import { useEffect, useState } from "react";
import { formatTimestamp } from "@/lib/format";
import { patchStaff } from "@/lib/use-staff-list";
import type { PaymentSummary, QuoteStatus, StatusChange } from "@/types";
import { PaymentCell } from "./PaymentCell";

interface CarpetRequest {
  ref: string;
  customerName: string;
  phone: string;
  item: string;
  quantity: string;
  deliveryLocation: string;
  notes: string;
  status: QuoteStatus;
  createdAt: string;
  payment?: PaymentSummary;
  /** Newest first. Names are the ones typed at sign-in: self-reported. */
  history?: StatusChange[];
}

const STATUSES: QuoteStatus[] = ["new", "contacted", "quoted", "closed"];

const th =
  "whitespace-nowrap px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slab-400";
const td = "px-3 py-2.5 align-top text-sm";

export function CarpetRequests({ refreshKey = 0 }: { refreshKey?: number }) {
  const [requests, setRequests] = useState<CarpetRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  // Bumped after a status change so the list reloads with the new history.
  const [reload, setReload] = useState(0);

  async function changeStatus(ref: string, status: QuoteStatus) {
    setWriteError(null);
    const result = await patchStaff(`/api/quote-requests/${encodeURIComponent(ref)}`, { status });
    if (!result.ok) {
      setWriteError(`Could not update ${ref}. The change was not saved — try again.`);
      return;
    }
    setReload((value) => value + 1);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/carpet-requests", { cache: "no-store" });
        if (response.status === 401) {
          throw new Error("Your session has expired. Reload to sign in again.");
        }
        if (!response.ok) throw new Error("Could not load carpet requests.");
        const body = (await response.json()) as { requests: CarpetRequest[] };
        if (!cancelled) setRequests(body.requests);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load carpet requests.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-read when the page says a payment moved.
  }, [refreshKey, reload]);

  if (error) {
    return (
      <p className="m-3 rounded-slab border-2 border-fail bg-fail-tint px-3 py-2 text-sm text-slab-800">
        {error}
      </p>
    );
  }
  if (requests === null) {
    return <p className="p-4 text-sm text-slab-500">Loading carpet requests...</p>;
  }
  if (requests.length === 0) {
    return (
      <p className="p-4 text-sm text-slab-600">
        No carpet or sofa-set requests yet. They arrive from /book/carpets.
      </p>
    );
  }

  return (
    <div className="p-3 md:overflow-x-auto md:p-0">
      {writeError ? (
        <p className="mb-3 rounded-slab border-2 border-fail bg-fail-tint px-3 py-2 text-sm text-slab-800">
          {writeError}
        </p>
      ) : null}
      <table className="record-table w-full border-collapse md:min-w-[46rem]">
        <thead className="bg-slab-900">
          <tr>
            <th className={th}>Received</th>
            <th className={th}>Customer</th>
            <th className={th}>Phone</th>
            <th className={th}>Wants</th>
            <th className={th}>Hand-over</th>
            <th className={th}>Payment</th>
            <th className={th}>Status</th>
          </tr>
        </thead>
        <tbody className="md:divide-y-2 md:divide-slab-100">
          {requests.map((request) => (
            <tr key={request.ref}>
              <td className={`${td} md:whitespace-nowrap`} data-head="">
                {formatTimestamp(request.createdAt)}
                <span className="mt-0.5 block font-mono text-xs font-normal text-slab-400">
                  {request.ref}
                </span>
              </td>
              <td className={`${td} font-semibold`} data-label="Customer">
                {request.customerName}
              </td>
              <td className={`${td} md:whitespace-nowrap`} data-label="Phone">
                <a
                  href={`tel:${request.phone.replace(/\s/g, "")}`}
                  className="underline underline-offset-4 hover:text-slab-600"
                >
                  {request.phone}
                </a>
              </td>
              <td className={td} data-label="Wants">
                <span className="whitespace-pre-line">{request.item}</span>
                <span className="mt-0.5 block text-xs text-slab-500">
                  {request.quantity}
                  {request.notes ? ` · ${request.notes}` : ""}
                </span>
              </td>
              <td className={td} data-label="Hand-over">
                {request.deliveryLocation}
              </td>
              <td className={td} data-label="Payment">
                {request.payment ? (
                  <PaymentCell payment={request.payment} kind="carpet" reference={request.ref} />
                ) : (
                  <span className="text-xs text-slab-500">No payment record</span>
                )}
              </td>
              <td className={td} data-label="Status">
                <label className="sr-only" htmlFor={`cp-status-${request.ref}`}>
                  Change status for carpet request {request.ref}
                </label>
                <select
                  id={`cp-status-${request.ref}`}
                  value={request.status}
                  onChange={(event) => void changeStatus(request.ref, event.target.value as QuoteStatus)}
                  className="min-h-9 rounded-slab border-2 border-slab-300 bg-white px-1.5 py-1 text-xs font-semibold focus:border-slab-900 focus:outline-none"
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                {request.history?.[0] ? (
                  <span className="mt-1 block text-xs text-slab-500">
                    Changed by {request.history[0].by} (self-reported),{" "}
                    {formatTimestamp(request.history[0].at)}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
