/**
 * =====================================================================
 * READING THE PRICE BOOK — pure lookups, safe on either side.
 * ---------------------------------------------------------------------
 * No database, no imports from src/lib/prices-db.ts, no server-only code.
 * A `PriceBook` is a plain object fetched on the server and passed down as
 * a prop, and everything in this file is a function over that object — so
 * the booking picker in the browser and the route handler that prices the
 * booking for real run the SAME code over the SAME numbers.
 *
 * That symmetry is the point. Before this stage the picker and the server
 * both read `row.prices` out of a compiled data file, which agreed for
 * free. Now the numbers arrive over a wire, and the only way they keep
 * agreeing is if there is exactly one function that decides what a cell
 * costs. This is it.
 *
 * NULL IS PRESERVED AT EVERY STEP. `PriceCell` is `number | null`, null
 * meaning nobody has transcribed this cell — never free, never a stand-in
 * for a real figure. A missing key folds to the same null, so a service
 * the seed forgot behaves like an unread cell rather than throwing or, far
 * worse, reading as zero.
 * =====================================================================
 */

import type {
  FlatPriceGroup,
  PriceBook,
  PriceCell,
  Product,
  VehicleTypeId,
  WashPriceRow,
} from "@/types";

/** The key one wash cell is stored under. One definition, used by both sides. */
export function washKey(serviceId: string, vehicleTypeId: string): string {
  return `${serviceId}:${vehicleTypeId}`;
}

/**
 * The board read at one cell: a real KES figure, or null.
 *
 * The replacement for `priceFor` in src/data/services.ts, and it carries
 * the same guarantee that function did — every price the booking flow
 * shows or charges goes through here, so "an unread cell can never be
 * charged" stays a property of the code rather than a habit.
 */
export function washPrice(
  book: PriceBook,
  serviceId: string,
  vehicleTypeId: VehicleTypeId,
): PriceCell {
  return book.wash[washKey(serviceId, vehicleTypeId)] ?? null;
}

/** True when this service can be booked online for this vehicle type. */
export function isBookable(
  book: PriceBook,
  serviceId: string,
  vehicleTypeId: VehicleTypeId,
): boolean {
  return washPrice(book, serviceId, vehicleTypeId) !== null;
}

/** One flat-priced board item — carpets, lorries, buses, motorbike. */
export function flatPrice(book: PriceBook, rowId: string): PriceCell {
  return book.flat[rowId] ?? null;
}

/** One concrete product. Null where the price is not confirmed. */
export function productPrice(book: PriceBook, productId: string): PriceCell {
  return book.product[productId] ?? null;
}

/**
 * The cheapest confirmed figure anywhere on the wash grid, for the home
 * page's and /book's "from KES ..." line.
 *
 * Computed rather than typed out, exactly as it was before the move. A
 * hardcoded "from 200" goes quietly wrong the first time somebody edits a
 * cell — and now that editing a cell takes ten seconds in the staff view
 * rather than a deploy, that is no longer a hypothetical.
 *
 * Returns null when the grid holds no confirmed cell at all, so the caller
 * has to decide what to say rather than printing "from KES 0".
 */
export function cheapestConfirmedPriceKes(book: PriceBook): number | null {
  const prices = Object.values(book.wash).filter(
    (price): price is number => price !== null,
  );
  return prices.length > 0 ? Math.min(...prices) : null;
}

/**
 * True when a product can be put in a cart at all.
 *
 * A product with no confirmed price is not sellable online — the cart
 * would have to carry a null, and the checkout would have to total it. The
 * catalogue still LISTS it, saying the price is not available and pointing
 * at the phone, exactly as the board does for an unread cell.
 */
export function isPurchasable(book: PriceBook, product: Product): boolean {
  return !product.quoteOnly && productPrice(book, product.id) !== null;
}

/* ------------------------------------------------------------------ */
/* Whole-grid helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Does this row have a price in ANY column?
 *
 * Used by the picker and the board to tell "this service is unavailable
 * for your vehicle" apart from "nobody has read this row at all" — two
 * states that deserve different words on screen.
 */
export function rowHasAnyPrice(
  book: PriceBook,
  row: WashPriceRow,
  vehicleTypeIds: readonly VehicleTypeId[],
): boolean {
  return vehicleTypeIds.some((id) => washPrice(book, row.id, id) !== null);
}

/** Every flat row in a group, paired with its current price. */
export function pricedFlatRows(
  book: PriceBook,
  group: FlatPriceGroup,
): { id: string; name: string; priceKes: PriceCell }[] {
  return group.rows.map((row) => ({
    id: row.id,
    name: row.name,
    priceKes: flatPrice(book, row.id),
  }));
}

/**
 * An EMPTY price book.
 *
 * Not a default and not a fallback to render with — every lookup against
 * it returns null, so a page handed this one shows "price not listed"
 * everywhere. It exists so a caller that genuinely has no book yet has
 * something type-correct to hold, and so that the failure is visibly "no
 * prices" rather than invented ones.
 */
export const EMPTY_PRICE_BOOK: PriceBook = { wash: {}, flat: {}, product: {} };
