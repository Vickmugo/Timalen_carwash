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
import { productKey, washKey } from "@/lib/prices";
import { getProductById } from "@/data/products";
import { flatPriceGroups, getVehicleType, getWashPriceRow } from "@/data/services";
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
  /** '' for a product sold at one price. Never null; see the migration. */
  variant_id: string;
  price_kes: number | null;
}

export interface PriceBookRead {
  book: PriceBook;
  /**
   * The sections that could not be read; empty when all three were. Their
   * cells are simply absent from `book`, so every lookup into them folds
   * to null like any other unpriced cell.
   */
  unavailable: PriceKind[];
}

/**
 * One section of the book, or null if it could not be read. Never throws:
 * a PostgREST error and a thrown one (network, bad URL) both end up here,
 * logged with the table name so the server log says which section went.
 */
async function readSection<T>(
  table: string,
  query: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[] | null> {
  try {
    const { data, error } = await query();
    if (!error) return (data ?? []) as T[];
    console.error(`[prices] ${table} unreadable, its prices show as not listed: ${error.message}`);
  } catch (error) {
    console.error(`[prices] ${table} unreadable, its prices show as not listed:`, error);
  }
  return null;
}

/**
 * THE WHOLE PRICE BOOK IN THREE QUERIES, RUN TOGETHER — AND NONE OF THEM
 * CAN TAKE A PAGE DOWN.
 *
 * `Promise.all` rather than three awaits in sequence: they do not depend
 * on each other, and this is on the critical path of every page that shows
 * a price.
 *
 * NEVER THROWS. This used to be the opposite decision: throw rather than
 * return an empty book, on the reasoning that "price not listed" on every
 * row reads as a statement about the business, where a page that fails to
 * render is obviously broken and gets fixed. The first real failure showed
 * what that costs. A missing column on `product_prices` alone took down
 * /, /book, /prices and /products — including the car wash booking flow,
 * which does not sell a single concrete product. One unreadable table
 * cost the whole site.
 *
 * So a failure is now contained to the cells it affects. Each section is
 * read on its own; one that fails is left empty and named in
 * `unavailable`, and every item in it renders as "price not listed — ask
 * at the yard", while the other two sections price normally. The
 * "obviously broken" half of the old argument is kept where it belongs:
 * in the server log, on the staff price screen (which names the section),
 * and at the one place money is taken — /api/bookings refuses to price a
 * booking from a wash section it could not read.
 */
export async function readPriceBook(): Promise<PriceBookRead> {
  const book: PriceBook = { wash: {}, flat: {}, product: {} };

  let db: ReturnType<typeof getSupabaseServiceRoleClient>;
  try {
    db = getSupabaseServiceRoleClient();
  } catch (error) {
    console.error("[prices] no database client, every price shows as not listed:", error);
    return { book, unavailable: ["wash", "flat", "product"] };
  }

  const [services, flats, products] = await Promise.all([
    readSection<ServicePriceRow>("service_prices", () =>
      db
        .from("service_prices")
        .select("service_id, vehicle_type_id, price_kes")
        .eq("business_id", BUSINESS_ID),
    ),
    readSection<FlatPriceRowRecord>("flat_prices", () =>
      db
        .from("flat_prices")
        .select("row_id, price_kes")
        .eq("business_id", BUSINESS_ID),
    ),
    readSection<ProductPriceRow>("product_prices", () =>
      db
        .from("product_prices")
        .select("product_id, variant_id, price_kes")
        .eq("business_id", BUSINESS_ID),
    ),
  ]);

  const unavailable: PriceKind[] = [];
  if (services === null) unavailable.push("wash");
  if (flats === null) unavailable.push("flat");
  if (products === null) unavailable.push("product");

  for (const row of services ?? []) {
    book.wash[washKey(row.service_id, row.vehicle_type_id)] = row.price_kes;
  }
  for (const row of flats ?? []) {
    book.flat[row.row_id] = row.price_kes;
  }
  for (const row of products ?? []) {
    book.product[productKey(row.product_id, row.variant_id)] = row.price_kes;
  }

  return { book, unavailable };
}

/**
 * The book alone, for a page that only renders it. Never throws; a section
 * that could not be read prices as not listed. See `readPriceBook`.
 */
export async function getPriceBook(): Promise<PriceBook> {
  return (await readPriceBook()).book;
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

/** What identifies one cell. Which fields matter depends on the kind. */
export interface PriceCellKey {
  serviceId?: string;
  vehicleTypeId?: VehicleTypeId;
  id?: string;
  /** Products only. Omitted for a product sold at one price. */
  variantId?: string;
}

/** Narrows the `.eq()` filters that identify one cell of a given kind. */
function cellFilter(kind: PriceKind, key: PriceCellKey): Record<string, string> {
  if (kind === "wash") {
    return {
      service_id: key.serviceId ?? "",
      vehicle_type_id: key.vehicleTypeId ?? "",
    };
  }
  if (kind === "flat") return { row_id: key.id ?? "" };
  // variant_id is ALWAYS filtered, '' included. Leaving it off for a
  // single-price product would match every height of a tiered one, and
  // maybeSingle() would fail on the second row rather than on the mistake.
  return { product_id: key.id ?? "", variant_id: key.variantId ?? "" };
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
 * call site shows what is being recorded. /api/prices passes the name on
 * the signed staff session, which is self-reported at sign-in and proves
 * nothing about who was at the keyboard — see src/lib/session.ts. Blank
 * becomes UNATTRIBUTED rather than an empty
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
  key: PriceCellKey,
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
    // From the staff session (src/lib/staff-guard.ts), never a request body.
    changed_by: by,
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
  /** What moved, in the editor's own wording: "Fencing Posts, 7 ft". */
  item: string;
  oldPriceKes: PriceCell;
  newPriceKes: PriceCell;
  by: string;
  at: string;
}

interface PriceChangeRecord {
  id: string;
  old_price_kes: number | null;
  new_price_kes: number | null;
  changed_by: string;
  changed_at: string;
  // The cell each entry moved, embedded through the log's foreign keys.
  // Exactly one is set; the one-parent CHECK on the table guarantees it.
  service_prices: { service_id: string; vehicle_type_id: string } | null;
  flat_prices: { row_id: string } | null;
  product_prices: { product_id: string; variant_id: string } | null;
}

/**
 * WHAT A LOGGED CELL IS, IN THE WORDS STAFF USE.
 *
 * The price tables carry ids and no names, deliberately — names belong to
 * the data files (see the header of the price-tables migration). So the
 * log is joined to the cell each entry moved, and that cell is named here
 * from the same files the editor reads, in the same wording: "Fencing
 * Posts, 7 ft" is the editor's row label and the line name on a receipt.
 *
 * Resolved when the log is read, not copied into `price_changes` when an
 * entry is written. A copied name would need a migration, and would go
 * stale on a rename where this does not: the row that was `column-cap`
 * reads as Wall Caps for its whole history, which is right, because it is
 * the same row and the same product.
 *
 * An id the files no longer know is shown AS AN ID and says so, rather
 * than dropped or guessed at — the log is exactly where somebody will look
 * for a thing that has since gone.
 */
function describeLoggedCell(record: PriceChangeRecord): string {
  if (record.product_prices) {
    const { product_id: productId, variant_id: variantId } = record.product_prices;
    const product = getProductById(productId);
    if (!product) {
      return `${productId}${variantId ? `, ${variantId}` : ""} (no longer in the catalogue)`;
    }
    if (!variantId) {
      // The one-figure row a product had before it was priced by height.
      // The tiers migration depriced it rather than deleting it.
      return product.variants ? `${product.name}, old single price (retired)` : product.name;
    }
    const variant = product.variants?.find((entry) => entry.id === variantId);
    return variant
      ? `${product.name}, ${variant.label}`
      : `${product.name}, ${variantId} (height no longer sold)`;
  }

  if (record.service_prices) {
    const { service_id: serviceId, vehicle_type_id: vehicleTypeId } = record.service_prices;
    const service = getWashPriceRow(serviceId)?.name ?? `${serviceId} (no longer on the board)`;
    return `${service}, ${getVehicleType(vehicleTypeId)?.name ?? vehicleTypeId}`;
  }

  if (record.flat_prices) {
    const { row_id: rowId } = record.flat_prices;
    for (const group of flatPriceGroups) {
      const row = group.rows.find((entry) => entry.id === rowId);
      // "Carpets, Small" — but not "Motorbike, Motorbike".
      if (row) return row.name === group.name ? row.name : `${group.name}, ${row.name}`;
    }
    return `${rowId} (no longer on the board)`;
  }

  return "Unknown item";
}

/**
 * The most recent price moves, newest first, each named.
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
    .select(
      "id, old_price_kes, new_price_kes, changed_by, changed_at, " +
        "service_prices (service_id, vehicle_type_id), " +
        "flat_prices (row_id), " +
        "product_prices (product_id, variant_id)",
    )
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listRecentPriceChanges: ${error.message}`);

  return ((data ?? []) as unknown as PriceChangeRecord[]).map((record) => ({
    id: record.id,
    item: describeLoggedCell(record),
    oldPriceKes: record.old_price_kes ?? null,
    newPriceKes: record.new_price_kes ?? null,
    by: record.changed_by,
    at: new Date(record.changed_at).toISOString(),
  }));
}
