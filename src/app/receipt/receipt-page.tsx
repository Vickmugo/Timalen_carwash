import "server-only";
import { notFound } from "next/navigation";
import { NotFound, OfficialReceipt, PendingReceipt } from "@/components/Receipt";
import { isRef } from "@/lib/format";
import { hasOfficialReceipt } from "@/lib/payments";
import { getReceiptByNumber } from "@/lib/payments-db";
import { receiptPageResult } from "@/lib/receipt-view";
import { getStaffSessionFromCookies } from "@/lib/staff-guard";
import type { PaymentSummary } from "@/types";

/**
 * =====================================================================
 * ONE RECEIPT PAGE, FOR BOOKINGS, ORDERS AND CARPET REQUESTS.
 * ---------------------------------------------------------------------
 * Shared by /receipt/booking, /receipt/order and /receipt/carpet so the
 * three cannot drift apart on who sees what.
 *
 *   STAFF SESSION      the full receipt, or the "no receipt yet" / "not
 *                      found" page that says why.
 *   ANYONE ELSE        an issued or voided receipt, masked
 *                      (src/lib/receipt-view.ts). EVERYTHING ELSE — no such
 *                      ref, no receipt yet, a claim, a rejection — is the
 *                      site's plain 404, identical in every case, so the
 *                      page cannot be used to learn which refs exist or how
 *                      a payment stands.
 *
 * Lookups are rate-limited per IP in src/proxy.ts, on the same counter as
 * the ref lookups in the API, before this runs.
 *
 * Only a `ReceiptView` reaches the markup. The receipt components render
 * on the server; the print button takes no props.
 * =====================================================================
 */

interface ReceiptPageConfig {
  /** The ref prefix this page accepts. */
  prefix: string;
  /** Reads the record; only its ref and payment are used. */
  load: (ref: string) => Promise<{ ref: string; payment?: PaymentSummary } | null>;
  backHref: (ref: string) => string;
  /** Staff-only "not found" page link. */
  notFoundBack: { href: string; label: string };
}

export async function ReceiptPage({
  config,
  params,
}: {
  config: ReceiptPageConfig;
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const staff = await getStaffSessionFromCookies();

  const record = isRef(ref, config.prefix) ? await config.load(ref) : null;
  const payment = record?.payment;
  const receipt =
    payment && hasOfficialReceipt(payment) && payment.receipt
      ? await getReceiptByNumber(payment.receipt.number)
      : null;

  const result = receiptPageResult({ audience: staff ? "staff" : "public", record, receipt });

  switch (result.show) {
    case "receipt":
      return <OfficialReceipt receipt={result.view} backHref={config.backHref(result.view.ref)} />;
    case "pending":
      return (
        <PendingReceipt
          reference={result.ref}
          status={result.status}
          backHref={config.backHref(result.ref)}
        />
      );
    case "not_found":
      return (
        <NotFound
          reference={ref}
          backHref={config.notFoundBack.href}
          backLabel={config.notFoundBack.label}
        />
      );
    case "hidden":
      notFound();
  }
}
