/**
 * =====================================================================
 * CONCRETE ORDERS, IN THE DATABASE.
 * ---------------------------------------------------------------------
 * SERVER ONLY, like src/lib/bookings-db.ts, and built the same way: a
 * mapping layer onto the `Order` type every page already renders, and the
 * same retry-on-collision for the reference.
 *
 * Until this file, orders lived in the browser that placed them
 * (src/lib/store.ts, key `demo.orders`). Those records are left where they
 * are: nothing here reads or deletes them. The checkout now writes here,
 * and the confirmation page, the receipt and the staff view read from
 * here, so an order placed on one phone is visible on every other.
 *
 * `orders` and `order_lines` have existed since the first migration (the
 * variant columns since 20260913120000); nothing wrote to them before.
 * =====================================================================
 */

import { BUSINESS_ID, getSupabaseServiceRoleClient } from "@/lib/supabase";
import { makeRef } from "@/lib/format";
import {
  PAYMENT_EMBED,
  insertPayment,
  latestPayment,
  type PaymentRow,
} from "@/lib/payments-db";
import type { PaymentChoice } from "@/lib/payments";
import type {
  CartLine,
  FulfilmentStatus,
  Order,
  PaymentStatus,
  StatusChange,
} from "@/types";

interface OrderLineRow {
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
}

interface OrderRow {
  id: string;
  ref: string;
  subtotal_kes: number;
  customer_name: string;
  phone: string;
  delivery_location: string;
  notes: string;
  payment_status: PaymentStatus;
  created_at: string;
  order_lines?: OrderLineRow[] | null;
  status_changes?: { to_status: string; changed_by: string; changed_at: string }[] | null;
  payments?: PaymentRow[] | null;
}

const ORDER_SELECT =
  "id, ref, subtotal_kes, customer_name, phone, delivery_location, notes, " +
  "payment_status, created_at, " +
  "order_lines(product_id, slug, name, unit_label, price_kes, quantity, status, " +
  "quote_only, variant_id, variant_label, position), " +
  "status_changes(to_status, changed_by, changed_at), " +
  PAYMENT_EMBED;

function toIso(timestamp: string): string {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? timestamp : parsed.toISOString();
}

/** Same reason for the cast as `asRow` in bookings-db.ts. */
function asRow(data: unknown): OrderRow {
  return data as OrderRow;
}

function toCartLine(row: OrderLineRow): CartLine {
  return {
    productId: row.product_id,
    // '' in the table means "sold at one price"; absent in the type.
    ...(row.variant_id
      ? { variantId: row.variant_id, variantLabel: row.variant_label }
      : {}),
    slug: row.slug,
    name: row.name,
    unitLabel: row.unit_label,
    priceKes: row.price_kes,
    quantity: row.quantity,
    status: row.status,
    quoteOnly: row.quote_only,
  };
}

export function toOrder(row: OrderRow): Order {
  const history: StatusChange[] = (row.status_changes ?? [])
    .slice()
    .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
    .map((change) => ({
      to: change.to_status,
      by: change.changed_by,
      at: toIso(change.changed_at),
    }));

  return {
    ref: row.ref,
    lines: (row.order_lines ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(toCartLine),
    subtotalKes: row.subtotal_kes,
    customerName: row.customer_name,
    phone: row.phone,
    deliveryLocation: row.delivery_location,
    notes: row.notes,
    paymentStatus: row.payment_status,
    ...(row.payments && row.payments.length > 0
      ? { payment: latestPayment(row.payments) }
      : {}),
    createdAt: toIso(row.created_at),
    ...(history.length > 0 ? { history } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

/**
 * What the route hands over: lines ALREADY PRICED by the server from the
 * live price book. Nothing in here came from the browser except the
 * product ids, heights, quantities and the customer's own details.
 */
export interface NewOrderInput {
  lines: CartLine[];
  subtotalKes: number;
  customerName: string;
  phone: string;
  /** Always COLLECT_FROM_YARD. The column is NOT NULL. */
  collection: string;
  notes: string;
  payment: PaymentChoice;
}

export type CreateOrderResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "code_used" }
  | { ok: false; reason: "ref_exhausted" }
  | { ok: false; reason: "db_error"; detail: string };

/** Same bound and reasoning as REF_ATTEMPTS in bookings-db.ts. */
const REF_ATTEMPTS = 5;
const UNIQUE_VIOLATION = "23505";

/**
 * Writes the order, its lines and its payment. Three writes and no
 * transaction (PostgREST has none), so the same compensating delete as a
 * booking: if the lines or the payment fail, the order goes, and its lines
 * with it by cascade. A half-written order is worse than a failed one.
 */
export async function createOrder(input: NewOrderInput): Promise<CreateOrderResult> {
  const db = getSupabaseServiceRoleClient();

  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt += 1) {
    // Same "OR-" format the localStorage checkout minted.
    const ref = makeRef("OR");

    const inserted = await db
      .from("orders")
      .insert({
        business_id: BUSINESS_ID,
        ref,
        subtotal_kes: input.subtotalKes,
        customer_name: input.customerName,
        phone: input.phone,
        delivery_location: input.collection,
        notes: input.notes,
        // The old column, kept in step for whatever still reads it; see
        // the same note in bookings-db.ts.
        payment_status: input.payment.method === "cash" ? "pay_on_collection" : "unpaid",
      })
      .select("id")
      .single();

    if (inserted.error) {
      if (inserted.error.code === UNIQUE_VIOLATION) continue;
      return { ok: false, reason: "db_error", detail: inserted.error.message };
    }

    const orderId = inserted.data.id as string;

    const lines = await db.from("order_lines").insert(
      input.lines.map((line, index) => ({
        order_id: orderId,
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
    if (lines.error) {
      await db.from("orders").delete().eq("id", orderId);
      return { ok: false, reason: "db_error", detail: lines.error.message };
    }

    const paid = await insertPayment({ orderId }, "concrete", input.payment, input.subtotalKes);
    if (!paid.ok) {
      await db.from("orders").delete().eq("id", orderId);
      if (paid.reason === "code_used") return { ok: false, reason: "code_used" };
      return { ok: false, reason: "db_error", detail: paid.detail };
    }

    const created = await db.from("orders").select(ORDER_SELECT).eq("id", orderId).single();
    if (created.error) {
      return { ok: false, reason: "db_error", detail: created.error.message };
    }
    return { ok: true, order: toOrder(asRow(created.data)) };
  }

  return { ok: false, reason: "ref_exhausted" };
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

/** Every order, newest first — the staff view's order. */
export async function listOrders(): Promise<Order[]> {
  const db = getSupabaseServiceRoleClient();
  const { data, error } = await db
    .from("orders")
    .select(ORDER_SELECT)
    .eq("business_id", BUSINESS_ID)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listOrders: ${error.message}`);
  return (data as unknown[]).map((row) => toOrder(asRow(row)));
}

/**
 * One order by its printed reference, or null. The reference is the only
 * credential, exactly as for bookings; read the note at the top of
 * src/app/api/bookings/[ref]/route.ts.
 */
export async function getOrderByRef(ref: string): Promise<Order | null> {
  const db = getSupabaseServiceRoleClient();
  const { data, error } = await db
    .from("orders")
    .select(ORDER_SELECT)
    .eq("business_id", BUSINESS_ID)
    .eq("ref", ref)
    .maybeSingle();
  if (error) throw new Error(`getOrderByRef: ${error.message}`);
  return data ? toOrder(asRow(data)) : null;
}
