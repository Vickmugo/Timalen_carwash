/**
 * =====================================================================
 * CARPET AND SOFA-SET REQUESTS — what was asked for, in words and money.
 * ---------------------------------------------------------------------
 * Pure, safe on either side, like src/lib/booking.ts: the form in the
 * browser shows the estimate from these, and /api/carpet-requests writes
 * the stored description from the same functions over a freshly read price
 * book, so the two cannot describe the same request differently.
 *
 * NOT A BOOKING. A carpet does not occupy the bay for a slot, so nothing
 * here touches src/lib/slots.ts. The customer says what they have, brings
 * it to the yard, and staff call when it is ready to collect.
 *
 * THE SIZES ARE THE BOARD'S. They are the rows of the "carpets" group in
 * src/data/services.ts, priced in `flat_prices` like the rest of the board.
 * Sofa Set has no legible figure, so it is offered and says "price on
 * request" — never a number.
 * =====================================================================
 */

import { flatPriceGroups } from "@/data/services";
import { formatKes } from "@/lib/format";
import { flatPrice } from "@/lib/prices";
import type { FlatPriceRow, PriceBook } from "@/types";

/** The board group whose rows this form offers. */
const CARPET_GROUP_ID = "carpets";

/**
 * Most of one size a single request may name. A bound on a public form,
 * not a business rule: a household does not send in forty rugs, and a
 * request that does is better as a phone call.
 */
export const CARPET_MAX_PER_ITEM = 20;

/**
 * What every new request stores in `quote_requests.delivery_location`.
 * Nothing is collected from or delivered to a customer; the column is NOT
 * NULL and old rows hold the hand-over the customer chose back when there
 * was a choice, so it is written rather than left blank.
 */
export const CARPET_HANDOVER_TEXT = "Brought to the yard by the customer";

/** Prefix on the reference, e.g. CP-4K9T2X. See quote-requests-db.ts. */
export const CARPET_REF_PREFIX = "CP";

/** Every size on the board, in board order. */
export function carpetRows(): FlatPriceRow[] {
  return flatPriceGroups.find((group) => group.id === CARPET_GROUP_ID)?.rows ?? [];
}

/** One chosen size and how many. */
export interface CarpetPick {
  id: string;
  quantity: number;
}

/**
 * What the priced part of a request comes to, and how many pieces have no
 * figure. The unpriced ones are counted, not valued: "KES 1,000 plus a sofa
 * set on request" is honest, "KES 1,000" alone is not.
 */
export function carpetEstimate(
  book: PriceBook,
  picks: CarpetPick[],
): { pricedKes: number; unpricedPieces: number } {
  let pricedKes = 0;
  let unpricedPieces = 0;
  for (const pick of picks) {
    const price = flatPrice(book, pick.id);
    if (price === null) unpricedPieces += pick.quantity;
    else pricedKes += price * pick.quantity;
  }
  return { pricedKes, unpricedPieces };
}

/**
 * The request as staff will read it: one line per size, with the figure it
 * was shown at, or "price on request". Stored in `quote_requests.item`.
 *
 * `pricesRead` false means the server could not read the board when the
 * request came in. The lines then say so, rather than "price on request",
 * which would be a claim about the yard's pricing that nobody made.
 */
export function carpetItemText(
  book: PriceBook,
  picks: CarpetPick[],
  pricesRead: boolean,
): string {
  const rows = carpetRows();
  return picks
    .map((pick) => {
      const name = rows.find((row) => row.id === pick.id)?.name ?? pick.id;
      const price = flatPrice(book, pick.id);
      const priced = !pricesRead
        ? "price not read at the time"
        : price === null
          ? "price on request"
          : `${formatKes(price)} each`;
      return `Carpets — ${name} x ${pick.quantity} (${priced})`;
    })
    .join("\n");
}

/**
 * True when every picked line has a figure on the board. M-Pesa is only
 * offered then: with a sofa set unpriced there is no amount to send, so the
 * request is paid at the yard once the price is confirmed there.
 */
export function carpetFullyPriced(book: PriceBook, picks: CarpetPick[]): boolean {
  return picks.length > 0 && picks.every((pick) => flatPrice(book, pick.id) !== null);
}

/** The picks with names and figures, as stored in `priced_lines`. */
export function carpetPricedLines(
  book: PriceBook,
  picks: CarpetPick[],
): { id: string; name: string; quantity: number; priceKes: number | null }[] {
  const rows = carpetRows();
  return picks.map((pick) => ({
    id: pick.id,
    name: rows.find((row) => row.id === pick.id)?.name ?? pick.id,
    quantity: pick.quantity,
    priceKes: flatPrice(book, pick.id),
  }));
}

/** "3 pieces" — stored in `quote_requests.quantity`, which is free text. */
export function carpetQuantityText(picks: CarpetPick[]): string {
  const pieces = picks.reduce((total, pick) => total + pick.quantity, 0);
  return `${pieces} piece${pieces === 1 ? "" : "s"}`;
}
