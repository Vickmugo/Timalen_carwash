/**
 * The single place the quote threshold is evaluated.
 *
 * Components ask this module whether a cart can be checked out; none of
 * them know the numbers. Change the numbers in src/data/config.ts.
 */

import { quoteRules } from "@/data/config";
import { getProductById } from "@/data/products";
import type { CartLine } from "@/types";
import { cartLineName } from "./cart-line";
import { formatKes } from "./format";

export interface QuoteEvaluation {
  /** True when this cart must go to the quote form instead of checkout. */
  requiresQuote: boolean;
  /** Customer-facing explanations, shown on the cart page. */
  reasons: string[];
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.priceKes * line.quantity, 0);
}

export function evaluateCart(lines: CartLine[]): QuoteEvaluation {
  const reasons: string[] = [];

  const quoteOnlyLines = lines.filter((line) => line.quoteOnly);
  for (const line of quoteOnlyLines) {
    reasons.push(`${cartLineName(line)} is custom work and is always priced by quote.`);
  }

  /*
    A LINE FROM BEFORE ITS PRODUCT WAS SOLD BY HEIGHT. Carts live in
    localStorage, so a basket holding "Fencing Posts x 10 at KES 750" — the
    retired 8 ft placeholder — survives the deploy that removed it. The line
    copied its price on purpose (see `addItem`), which is exactly why it
    cannot be trusted now: it is a price for a height the yard does not
    sell. Routed to a quote rather than dropped, because silently deleting
    things from somebody's basket is worse, and a person on the phone can
    ask which height they meant.
  */
  const missingHeight = lines.filter(
    (line) => !line.variantId && getProductById(line.productId)?.variants,
  );
  for (const line of missingHeight) {
    reasons.push(
      `${line.name}: this was added before we priced it by height, so the price on it is out of date. Remove it and add the height you need, or send it as a quote.`,
    );
  }

  /*
    PER LINE, AND A LINE IS ONE HEIGHT. Forty 7 ft posts and forty 10 ft
    posts are two lines of forty, neither over the limit: the threshold
    applies per selected height, not summed across a product's heights.
    That was the stated rule for the tiers stage, and it falls out of the
    cart shape rather than needing code of its own. The order-total rule
    below still sees everything.
  */
  const overQuantity = lines.filter(
    (line) => line.quantity > quoteRules.maxUnitsPerLine,
  );
  for (const line of overQuantity) {
    reasons.push(
      `${cartLineName(line)}: orders over ${quoteRules.maxUnitsPerLine} units are quoted so we can confirm production and delivery.`,
    );
  }

  const subtotal = cartSubtotal(lines);
  if (subtotal > quoteRules.maxOrderTotalKes) {
    reasons.push(
      `Orders above ${formatKes(quoteRules.maxOrderTotalKes)} are quoted so we can confirm delivery cost before you pay.`,
    );
  }

  return { requiresQuote: reasons.length > 0, reasons };
}

/** True for a single product that can never be added to a payable cart. */
export function isQuoteOnly(product: { quoteOnly: boolean }): boolean {
  return product.quoteOnly;
}
