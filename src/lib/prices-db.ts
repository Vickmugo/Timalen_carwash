/**
 * =====================================================================
 * PRICES, IN THE DATABASE — reading the book and moving a figure.
 * ---------------------------------------------------------------------
 * SERVER ONLY, like src/lib/bookings-db.ts and for the same reason: every
 * function reaches for the service-role client, which throws if this
 * module is ever evaluated in a browser. The route handlers in
 * src/app/api/prices/ are the boundary.
 *
 * NOTHING IS CACHED HERE, DELIBERATELY. `getPriceBook()` is one round trip
 * per render, and the brief for this stage was that an edit takes effect
 * immediately — no draft, no approval, no "mark as sent". A cache with any
 * lifetime at all would mean a staff member changes a price, reloads the
 * public page, and sees the old one; they would then change it again.
 * Three small tables on a business doing a few dozen bookings a day is not
 * a query worth optimising ahead of that.
 *
 * THE COST OF THAT, STATED PLAINLY: the home page, /prices, /products and
 * the booking flow can no longer be statically generated. They were
 * prerendered at build time when prices were compiled constants; they are
 * now rendered per request. That is the price of live editing and it was
 * the explicit ask.
 * =====================================================================
 */

import { BUSINESS_ID, getSupabaseServiceRoleClient } from "@/lib/supabase";
import { washKey } from "@/lib/prices";
import { UNATTRIBUTED } from "@/data/admin-users";
import type { PriceBook, PriceCell, VehicleTypeId } from "@/types";

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

interface ServicePriceRow {
  service_id: string;
  vehicle_type_id: string;
  price_kes: number | null;
}

interface FlatPriceRowRecord {
  row_id: string;
  price_kes: number | null;
}

interface ProductPriceRow {
  product_id: string;
  price_kes: number | null;
}

/**
 * THE WHOLE PRICE BOOK IN THREE QUERIES, RUN TOGETHER.
 *
 * `Promise.all` rather than three awaits in sequence: they do not depend
 * on each other, and this is on the critical path of every page that shows
 * a price.
 *
 * Throws on failure rather than returning an empty book. That is the
 * important decision in this file. An empty book renders as "price not
 * listed" on every row of a public price list — which looks like a
 * deliberate statement about the business rather than a broken database,
 * and would quietly tell customers the yard has stopped pricing its work.
 * A page that fails to render is the better failure: it is obviously
 * broken, and it gets fixed.
 */
export async function getPriceBook(): Promise<PriceBook> {
  const db = getSupabaseServiceRoleClient();

  const [services, flats, products] = await Promise.all([
    db
      .from("service_prices")
      .select("service_id, vehicle_type_id, price_kes")
      .eq("business_id", BUSINESS_ID),
    db
      .from("flat_prices")
      .select("row_id, price_kes")
      .eq("business_id", BUSINESS_ID),
    db
      .from("product_prices")
      .select("product_id, price_kes")
      .eq("business_id", BUSINESS_ID),
  ]);

  if (services.error) throw new Error(`getPriceBook services: ${services.error.message}`);
  if (flats.error) throw new Error(`getPriceBook flat: ${flats.error.message}`);
  if (products.error) throw new Error(`getPriceBook products: ${products.error.message}`);

  const book: PriceBook = { wash: {}, flat: {}, product: {} };

  for (const row of (services.data ?? []) as ServicePriceRow[]) {
    book.wash[washKey(row.service_id, row.vehicle_type_id)] = row.price_kes;
  }
  for (const row of (flats.data ?? []) as FlatPriceRowRecord[]) {
    book.flat[row.row_id] = row.price_kes;
  }
  for (const row of (products.data ?? []) as ProductPriceRow[]) {
    book.product[row.product_id] = row.price_kes;
  }

  return book;
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

export type PriceKind = "wash" | "flat" | "product";

export type SetPriceResult =
  | { ok: true; oldPriceKes: PriceCell; newPriceKes: PriceCell }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "db_error"; detail: string };

/**
 * Which table and which columns identify a cell, per kind.
 *
 * One table rather than three near-identical functions: the write is the
 * same five steps every time — find the row, read what it says now, set
 * the new figure, log the move, report it — and three copies of that is
 * three places for the logging step to be forgotten. The only thing that
 * differs is where to look, so only that is data.
 */
const TABLES = {
  wash: { table: "service_prices", fk: "service_price_id" },
  flat: { table: "flat_prices", fk: "flat_price_id" },
  product: { table: "product_prices", fk: "product_price_id" },
} as const;

/** Narrows the `.eq()` filters that identify one cell of a given kind. */
function cellFilter(
  kind: PriceKind,
  key: { serviceId?: string; vehicleTypeId?: VehicleTypeId; id?: string },
): Record<string, string> {
  if (kind === "wash") {
    return {
      service_id: key.serviceId ?? "",
      vehicle_type_id: key.vehicleTypeId ?? "",
    };
  }
  if (kind === "flat") return { row_id: key.id ?? "" };
  return { product_id: key.id ?? "" };
}

/**
 * MOVES ONE PRICE AND WRITES THE AUDIT ROW.
 *
 * There is no path through this module that changes a figure without
 * logging it — the same guarantee `writeStatusChange` gave the booking
 * statuses, and it matters more here. A price applies to every future
 * customer, it is now editable by anyone holding the shared staff
 * password, and there is no approval step between the edit and the live
 * site. The log is the only record that it happened.
 *
 * `by` is passed in rather than read from a session inside here, so the
 * call site shows what is being recorded. It is the self-reported "Acting
 * as" name and proves nothing about who was at the keyboard — see
 * src/data/admin-users.ts. Blank becomes UNATTRIBUTED rather than an empty
 * string, so an anonymous change is recorded as anonymous instead of as a
 * change by somebody called "".
 *
 * NOT ATOMIC, the same way the booking write is not: PostgREST has no
 * multi-statement transaction, so this is an UPDATE followed by an INSERT.
 * If the audit insert fails, the price has moved with no record of who
 * moved it — the wrong way round, and called out rather than hidden. The
 * fix is the same one the bookings path wants: a Postgres function doing
 * both inside one transaction, which is a schema change and a separate
 * migration.
 *
 * `newPriceKes` MAY BE NULL, and that is a real operation rather than a
 * failure to supply a value: it deprices the cell, returning it to "not
 * listed". A yard that cannot stand behind a figure should be able to take
 * it down without inventing a different one.
 */
export async function setPrice(
  kind: PriceKind,
  key: { serviceId?: string; vehicleTypeId?: VehicleTypeId; id?: string },
  newPriceKes: PriceCell,
  by: string,
): Promise<SetPriceResult> {
  const db = getSupabaseServiceRoleClient();
  const { table, fk } = TABLES[kind];
  const filter = cellFilter(kind, key);

  // What it says now. Read first, because the audit row records the move
  // and an UPDATE cannot tell us what it overwrote.
  let existing = db
    .from(table)
    .select("id, price_kes")
    .eq("business_id", BUSINESS_ID);
  for (const [column, value] of Object.entries(filter)) {
    existing = existing.eq(column, value);
  }

  const found = await existing.maybeSingle();
  if (found.error) {
    return { ok: false, reason: "db_error", detail: found.error.message };
  }
  if (!found.data) {
    // No row for this id. Means the seed never covered it — a service or
    // product in the data files with no cell in the database. Reported as
    // not_found rather than silently inserted: a price appearing for an id
    // nobody seeded is more likely a typo than an intention.
    return { ok: false, reason: "not_found" };
  }

  const rowId = found.data.id as string;
  const oldPriceKes = (found.data.price_kes ?? null) as PriceCell;

  const updated = await db
    .from(table)
    .update({ price_kes: newPriceKes, updated_at: new Date().toISOString() })
    .eq("id", rowId);

  if (updated.error) {
    return { ok: false, reason: "db_error", detail: updated.error.message };
  }

  const logged = await db.from("price_changes").insert({
    [fk]: rowId,
    old_price_kes: oldPriceKes,
    new_price_kes: newPriceKes,
    // Trimmed because the name comes from a free-text field; a stray space
    // would otherwise store " " and read as an anonymous change.
    changed_by: by.trim() || UNATTRIBUTED,
  });

  if (logged.error) {
    return { ok: false, reason: "db_error", detail: logged.error.message };
  }

  return { ok: true, oldPriceKes, newPriceKes };
}

/* ------------------------------------------------------------------ */
/* The log                                                             */
/* ------------------------------------------------------------------ */

export interface PriceChangeEntry {
  id: string;
  oldPriceKes: PriceCell;
  newPriceKes: PriceCell;
  by: string;
  at: string;
}

/**
 * The most recent price moves, newest first.
 *
 * Capped by the caller. Unlike the booking history there is no per-cell
 * limit in the schema — this is an audit trail on the numbers that decide
 * what customers pay, and trimming it would be discarding exactly the
 * record somebody will one day need.
 */
export async function listRecentPriceChanges(
  limit = 20,
): Promise<PriceChangeEntry[]> {
  const db = getSupabaseServiceRoleClient();

  const { data, error } = await db
    .from("price_changes")
    .select("id, old_price_kes, new_price_kes, changed_by, changed_at")
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listRecentPriceChanges: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    oldPriceKes: (row.old_price_kes ?? null) as PriceCell,
    newPriceKes: (row.new_price_kes ?? null) as PriceCell,
    by: row.changed_by as string,
    at: new Date(row.changed_at as string).toISOString(),
  }));
}
