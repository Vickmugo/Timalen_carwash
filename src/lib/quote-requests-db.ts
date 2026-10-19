/**
 * =====================================================================
 * QUOTE REQUESTS, IN THE DATABASE — the first code that writes them.
 * ---------------------------------------------------------------------
 * SERVER ONLY, like src/lib/bookings-db.ts: every function reaches for the
 * service-role client. /api/carpet-requests is the boundary.
 *
 * `quote_requests` has existed since the first migration and, until this
 * file, nothing wrote to it. The concrete quote form still saves to the
 * visitor's own localStorage (src/lib/store.ts); only carpet and sofa-set
 * requests land here. Moving the concrete form over is its own job.
 *
 * HEADER ROWS ONLY, NO `quote_request_lines`. That table is shaped for a
 * product cart line — `price_kes` NOT NULL, a stock `status` CHECK — and a
 * sofa set has no price to put in it. So what was asked for is written as
 * text in `item` and `quantity`, which is what those columns were built to
 * hold ("the staff member reading it is the parser"; see the migration).
 *
 * THE REFERENCE PREFIX IS THE ONLY WAY TO TELL THE KINDS APART. There is no
 * `kind` column, and adding one is a migration nobody asked for. Carpet
 * requests are minted as CP-XXXXXX and read back by that prefix, so the day
 * concrete quotes (QT-) move here, neither list swallows the other.
 * =====================================================================
 */

import { BUSINESS_ID, getSupabaseServiceRoleClient } from "@/lib/supabase";
import { makeRef } from "@/lib/format";
import { PAYMENT_EMBED, latestPayment, type PaymentRow } from "@/lib/payments-db";
import type { PaymentSummary, QuoteStatus } from "@/types";

/**
 * One size on a carpet request, priced by the server when it arrived.
 * Stored in `quote_requests.priced_lines` (payments migration) so a
 * receipt can itemise it. `priceKes` null = no figure on the board.
 */
export interface PricedCarpetLine {
  id: string;
  name: string;
  quantity: number;
  priceKes: number | null;
}

export interface NewQuoteRequestInput {
  /** Two letters; see the header. */
  refPrefix: string;
  customerName: string;
  phone: string;
  item: string;
  quantity: string;
  /** Where it is delivered to or collected from. Free text. */
  deliveryLocation: string;
  notes: string;
  /** Carpet requests only. Omitted, the column defaults to '[]'. */
  pricedLines?: PricedCarpetLine[];
}

export interface StoredQuoteRequest {
  ref: string;
  customerName: string;
  phone: string;
  item: string;
  quantity: string;
  deliveryLocation: string;
  notes: string;
  status: QuoteStatus;
  createdAt: string;
  /** The latest payment, absent on requests from before payments. */
  payment?: PaymentSummary;
}

export type CreateQuoteRequestResult =
  | { ok: true; ref: string; id: string }
  | { ok: false; reason: "ref_exhausted" }
  | { ok: false; reason: "db_error"; detail: string };

/** Same bound and same reasoning as REF_ATTEMPTS in bookings-db.ts. */
const REF_ATTEMPTS = 5;
const UNIQUE_VIOLATION = "23505";

/**
 * Writes one request, status `new`. One insert, so unlike a booking there
 * is nothing to compensate: it is either stored or it is not.
 */
export async function createQuoteRequest(
  input: NewQuoteRequestInput,
): Promise<CreateQuoteRequestResult> {
  const db = getSupabaseServiceRoleClient();

  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt += 1) {
    const ref = makeRef(input.refPrefix);
    const inserted = await db.from("quote_requests").insert({
      ...(input.pricedLines
        ? {
            priced_lines: input.pricedLines.map((line) => ({
              id: line.id,
              name: line.name,
              quantity: line.quantity,
              price_kes: line.priceKes,
            })),
          }
        : {}),
      business_id: BUSINESS_ID,
      ref,
      customer_name: input.customerName,
      phone: input.phone,
      item: input.item,
      quantity: input.quantity,
      delivery_location: input.deliveryLocation,
      notes: input.notes,
      status: "new",
    }).select("id").single();

    if (!inserted.error) return { ok: true, ref, id: inserted.data.id as string };
    // A reference collision: take a different one. Anything else is real.
    if (inserted.error.code === UNIQUE_VIOLATION) continue;
    return { ok: false, reason: "db_error", detail: inserted.error.message };
  }

  return { ok: false, reason: "ref_exhausted" };
}

/**
 * One carpet request by reference, with its payment, for the customer's
 * receipt page. Reference-only access, like a booking.
 */
export async function getQuoteRequestByRef(
  ref: string,
): Promise<StoredQuoteRequest | null> {
  const db = getSupabaseServiceRoleClient();
  const { data, error } = await db
    .from("quote_requests")
    .select(
      "ref, customer_name, phone, item, quantity, delivery_location, notes, status, created_at, " +
        PAYMENT_EMBED,
    )
    .eq("business_id", BUSINESS_ID)
    .eq("ref", ref)
    .maybeSingle();
  if (error) throw new Error(`getQuoteRequestByRef: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as Record<string, string> & { payments?: PaymentRow[] };
  const payment = latestPayment(row.payments);
  return {
    ref: row.ref,
    customerName: row.customer_name,
    phone: row.phone,
    item: row.item,
    quantity: row.quantity,
    deliveryLocation: row.delivery_location,
    notes: row.notes,
    status: row.status as QuoteStatus,
    createdAt: row.created_at,
    ...(payment ? { payment } : {}),
  };
}

/** Every request minted with this prefix, newest first. */
export async function listQuoteRequests(
  refPrefix: string,
): Promise<StoredQuoteRequest[]> {
  const db = getSupabaseServiceRoleClient();

  const { data, error } = await db
    .from("quote_requests")
    .select(
      "ref, customer_name, phone, item, quantity, delivery_location, notes, status, created_at, " +
        PAYMENT_EMBED,
    )
    .eq("business_id", BUSINESS_ID)
    .like("ref", `${refPrefix}-%`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listQuoteRequests: ${error.message}`);

  // The embedded payments defeat supabase-js's select-string inference;
  // same cast as `asRows` in bookings-db.ts.
  const rows = (data ?? []) as unknown as (Record<string, unknown> & {
    payments?: PaymentRow[];
  })[];
  return rows.map((row) => {
    const created = new Date(row.created_at as string);
    const payment = latestPayment(row.payments);
    return {
      ref: row.ref as string,
      customerName: row.customer_name as string,
      phone: row.phone as string,
      item: row.item as string,
      quantity: row.quantity as string,
      deliveryLocation: row.delivery_location as string,
      notes: row.notes as string,
      status: row.status as QuoteStatus,
      createdAt: Number.isNaN(created.getTime())
        ? (row.created_at as string)
        : created.toISOString(),
      ...(payment ? { payment } : {}),
    };
  });
}
