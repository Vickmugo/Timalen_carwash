/**
 * =====================================================================
 * QUOTE REQUESTS, IN THE DATABASE — the first code that writes them.
 * ---------------------------------------------------------------------
 * SERVER ONLY, like src/lib/bookings-db.ts: every function reaches for the
 * service-role client. /api/carpet-requests is the boundary.
 *
 * Two kinds live here: carpet and sofa-set requests (CP-, from
 * /api/carpet-requests) and concrete quote requests (QT-, from
 * /api/quote-requests — until that route existed, the /quote form only
 * saved to the customer's own browser and never reached the yard).
 *
 * CARPET REQUESTS ARE HEADER ROWS ONLY. `quote_request_lines` is shaped for
 * a product cart line — `price_kes` NOT NULL, a stock `status` CHECK — and
 * a sofa set has no price to put in it, so what was asked for is text in
 * `item` and `quantity`. QUOTE REQUESTS sent from a cart also get one
 * `quote_request_lines` row per product, carrying the price listed at the
 * time as a reference for staff, not a promise to the customer.
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
import type { CartLine, FulfilmentStatus, PaymentSummary, QuoteStatus, StatusChange } from "@/types";

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

/** Columns every staff list reads, with history and any product lines. */
const LIST_SELECT =
  "id, ref, customer_name, phone, item, quantity, delivery_location, notes, status, created_at, " +
  "status_changes(to_status, changed_by, changed_at), " +
  "quote_request_lines(product_id, slug, name, unit_label, price_kes, quantity, status, " +
  "quote_only, variant_id, variant_label, position), " +
  PAYMENT_EMBED;

interface ListRow {
  ref: string;
  customer_name: string;
  phone: string;
  item: string;
  quantity: string;
  delivery_location: string;
  notes: string;
  status: string;
  created_at: string;
  status_changes?: { to_status: string; changed_by: string; changed_at: string }[] | null;
  quote_request_lines?: {
    product_id: string;
    slug: string;
    name: string;
    unit_label: string;
    price_kes: number;
    quantity: number;
    status: FulfilmentStatus;
    quote_only: boolean;
    variant_id: string;
    variant_label: string;
    position: number;
  }[] | null;
  payments?: PaymentRow[];
}

function toIso(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

/** A request as the staff view reads it: history newest first, lines in order. */
export interface StaffQuoteRequest extends StoredQuoteRequest {
  lines: CartLine[];
  history?: StatusChange[];
}

function toStaffQuoteRequest(row: ListRow): StaffQuoteRequest {
  const payment = latestPayment(row.payments);
  const history = (row.status_changes ?? [])
    .slice()
    .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
    .map((change) => ({ to: change.to_status, by: change.changed_by, at: toIso(change.changed_at) }));
  return {
    ref: row.ref,
    customerName: row.customer_name,
    phone: row.phone,
    item: row.item,
    quantity: row.quantity,
    deliveryLocation: row.delivery_location,
    notes: row.notes,
    status: row.status as QuoteStatus,
    createdAt: toIso(row.created_at),
    lines: (row.quote_request_lines ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((line) => ({
        productId: line.product_id,
        ...(line.variant_id ? { variantId: line.variant_id, variantLabel: line.variant_label } : {}),
        slug: line.slug,
        name: line.name,
        unitLabel: line.unit_label,
        priceKes: line.price_kes,
        quantity: line.quantity,
        status: line.status,
        quoteOnly: line.quote_only,
      })),
    ...(history.length > 0 ? { history } : {}),
    ...(payment ? { payment } : {}),
  };
}

/** Every request minted with this prefix, newest first. */
export async function listQuoteRequests(refPrefix: string): Promise<StaffQuoteRequest[]> {
  const db = getSupabaseServiceRoleClient();
  const { data, error } = await db
    .from("quote_requests")
    .select(LIST_SELECT)
    .eq("business_id", BUSINESS_ID)
    .like("ref", `${refPrefix}-%`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listQuoteRequests: ${error.message}`);
  return ((data ?? []) as unknown as ListRow[]).map(toStaffQuoteRequest);
}

/**
 * The product lines on a concrete quote request, written after the header
 * row. `priceKes` is the price listed when the request arrived (0 if none
 * was listed): a reference for whoever phones the customer back.
 */
export async function insertQuoteRequestLines(
  quoteRequestId: string,
  lines: CartLine[],
): Promise<{ ok: true } | { ok: false; detail: string }> {
  if (lines.length === 0) return { ok: true };
  const db = getSupabaseServiceRoleClient();
  const { error } = await db.from("quote_request_lines").insert(
    lines.map((line, index) => ({
      quote_request_id: quoteRequestId,
      product_id: line.productId,
      slug: line.slug,
      name: line.name,
      unit_label: line.unitLabel,
      price_kes: line.priceKes,
      quantity: line.quantity,
      status: line.status,
      quote_only: line.quoteOnly,
      variant_id: line.variantId ?? "",
      variant_label: line.variantLabel ?? "",
      position: index,
    })),
  );
  return error ? { ok: false, detail: error.message } : { ok: true };
}

/** Removes a request whose follow-up writes failed, so no half-record is left. */
export async function deleteQuoteRequest(id: string): Promise<void> {
  await getSupabaseServiceRoleClient().from("quote_requests").delete().eq("id", id);
}

export const QUOTE_STATUSES: QuoteStatus[] = ["new", "contacted", "quoted", "closed"];

export type UpdateQuoteStatusResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "db_error"; detail: string };

/**
 * Moves a quote or carpet request to another status and records who did,
 * in `status_changes`. `by` is the name on the staff session — never a
 * value from a request body.
 */
export async function updateQuoteRequestStatus(
  ref: string,
  status: QuoteStatus,
  by: string,
): Promise<UpdateQuoteStatusResult> {
  const db = getSupabaseServiceRoleClient();
  const updated = await db
    .from("quote_requests")
    .update({ status })
    .eq("business_id", BUSINESS_ID)
    .eq("ref", ref)
    .select("id")
    .maybeSingle();
  if (updated.error) return { ok: false, reason: "db_error", detail: updated.error.message };
  if (!updated.data) return { ok: false, reason: "not_found" };

  const history = await db.from("status_changes").insert({
    quote_request_id: updated.data.id as string,
    to_status: status,
    // From the staff session (src/lib/staff-guard.ts), never a request body.
    changed_by: by,
  });
  if (history.error) return { ok: false, reason: "db_error", detail: history.error.message };
  return { ok: true };
}
