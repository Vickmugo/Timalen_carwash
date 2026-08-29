/**
 * The single place the quote threshold is evaluated.
 *
 * Components ask this module whether a cart can be checked out; none of
 * them know the numbers. Change the numbers in src/data/config.ts.
 */

import { quoteRules } from "@/data/config";
import type { CartLine } from "@/types";
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
    reasons.push(`${line.name} is custom work and is always priced by quote.`);
  }

  const overQuantity = lines.filter(
    (line) => line.quantity > quoteRules.maxUnitsPerLine,
  );
  for (const line of overQuantity) {
    reasons.push(
      `${line.name}: orders over ${quoteRules.maxUnitsPerLine} units are quoted so we can confirm production and delivery.`,
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
