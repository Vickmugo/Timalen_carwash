/**
 * Identifying and naming a cart line. Pure, safe on either side.
 *
 * Before variants, `productId` was a line's identity and `name` was all a
 * receipt needed. Neither holds for a product sold by height: two lines
 * can share a product id, and "Fencing Posts x 40" on a receipt does not
 * say what was bought. Every place that keys or labels a line — the cart,
 * checkout, the confirmation, the quote form, the receipt, the staff view
 * — goes through these two so none of them can drop the height.
 */

import { productKey } from "@/lib/prices";
import type { CartLine } from "@/types";

/** Unique within one basket. Same shape as the price book's product key. */
export function cartLineKey(line: Pick<CartLine, "productId" | "variantId">): string {
  return productKey(line.productId, line.variantId);
}

/** "Fencing Posts, 7 ft" — or just the name for a single-price product. */
export function cartLineName(line: Pick<CartLine, "name" | "variantLabel">): string {
  return line.variantLabel ? `${line.name}, ${line.variantLabel}` : line.name;
}
