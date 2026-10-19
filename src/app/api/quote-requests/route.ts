import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COLLECT_FROM_YARD } from "@/data/config";
import { getProductById } from "@/data/products";
import { cartLineKey } from "@/lib/cart-line";
import { productPrice } from "@/lib/prices";
import { readPriceBook } from "@/lib/prices-db";
import {
  createQuoteRequest,
  deleteQuoteRequest,
  insertQuoteRequestLines,
  listQuoteRequests,
} from "@/lib/quote-requests-db";
import { LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { cleanCustomerName, cleanText, readJsonBody } from "@/lib/request-body";
import { isStaffRequest } from "@/lib/staff-guard";
import { isValidKenyanPhone } from "@/lib/validate";
import type { CartLine } from "@/types";

/**
 * =====================================================================
 * /api/quote-requests — concrete quote requests (bulk and custom work).
 * ---------------------------------------------------------------------
 * Until this route existed, /quote saved the request to the customer's own
 * browser and nothing reached the yard. Now:
 *
 *   POST  public. Validated and capped like /api/carpet-requests, counted
 *         against the per-IP write limit, stored as a QT- request with
 *         status `new`. Collection from the yard only — nothing here
 *         offers delivery. NO PRICE IS PROMISED: product lines sent from a
 *         cart are stored with the price listed at the time, for staff,
 *         and the customer is told only that the yard will call.
 *   GET   staff only. Every QT- request, newest first, with its lines and
 *         status history.
 * =====================================================================
 */

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

const QUOTE_REF_PREFIX = "QT";
const MAX_LINES = 30;
const MAX_QUANTITY = 100_000;

export async function GET(request: NextRequest) {
  if (!isStaffRequest(request)) return json({ error: "not_authorised" }, 401);
  try {
    return json({ requests: await listQuoteRequests(QUOTE_REF_PREFIX) }, 200);
  } catch (error) {
    console.error("[api/quote-requests] GET failed:", error);
    return json({ error: "read_failed" }, 503);
  }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, LIMITS.quoteCreate);
  if (!limited.allowed) return tooManyRequests(limited);

  const parsed = await readJsonBody<{
    customerName?: unknown;
    phone?: unknown;
    item?: unknown;
    quantity?: unknown;
    notes?: unknown;
    lines?: unknown;
  } | null>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body ?? {};

  const customerName = cleanCustomerName(body.customerName);
  const phone = cleanText(body.phone);
  const item = cleanText(body.item);
  const quantity = cleanText(body.quantity);
  const notes = cleanText(body.notes);

  if (!customerName) return json({ error: "bad_request", detail: "Name is required." }, 400);
  if (!isValidKenyanPhone(phone)) {
    return json({ error: "bad_request", detail: "That phone number is not valid." }, 400);
  }
  if (!item) return json({ error: "bad_request", detail: "Say what you need." }, 400);
  if (!quantity) return json({ error: "bad_request", detail: "Say how many, or how much." }, 400);

  /* ---- optional product lines, when the request came from a cart ---- */
  const requested = Array.isArray(body.lines) ? body.lines : [];
  if (requested.length > MAX_LINES) {
    return json({ error: "bad_request", detail: "Too many items in one request." }, 400);
  }

  const lines: CartLine[] = [];
  if (requested.length > 0) {
    // A price book that cannot be read is not a reason to lose the request:
    // the lines are stored with 0 and staff price it on the phone anyway.
    const { book, unavailable } = await readPriceBook();
    const pricesRead = !unavailable.includes("product");
    const seen = new Set<string>();

    for (const entry of requested) {
      const { productId, variantId, quantity: count } = (entry ?? {}) as {
        productId?: unknown;
        variantId?: unknown;
        quantity?: unknown;
      };
      const product = typeof productId === "string" ? getProductById(productId) : undefined;
      if (!product) {
        return json({ error: "bad_request", detail: "One of those items is not in our catalogue." }, 400);
      }
      const variant =
        typeof variantId === "string" && variantId
          ? product.variants?.find((candidate) => candidate.id === variantId)
          : undefined;
      if (typeof variantId === "string" && variantId && !variant) {
        return json({ error: "bad_request", detail: `Unknown size for ${product.name}.` }, 400);
      }
      if (
        typeof count !== "number" ||
        !Number.isInteger(count) ||
        count < 1 ||
        count > MAX_QUANTITY
      ) {
        return json({ error: "bad_request", detail: "Quantities must be whole numbers." }, 400);
      }
      const key = cartLineKey({ productId: product.id, variantId: variant?.id });
      if (seen.has(key)) {
        return json({ error: "bad_request", detail: "The same item appears twice." }, 400);
      }
      seen.add(key);

      lines.push({
        productId: product.id,
        ...(variant ? { variantId: variant.id, variantLabel: variant.label } : {}),
        slug: product.slug,
        name: product.name,
        unitLabel: product.unitLabel,
        priceKes: (pricesRead ? productPrice(book, product.id, variant?.id) : null) ?? 0,
        quantity: count,
        status: product.status,
        quoteOnly: product.quoteOnly,
      });
    }
  }

  try {
    const created = await createQuoteRequest({
      refPrefix: QUOTE_REF_PREFIX,
      customerName,
      phone,
      item,
      quantity,
      // NOT NULL in the schema; this business only does collection.
      deliveryLocation: COLLECT_FROM_YARD,
      notes,
    });
    if (!created.ok) {
      console.error(
        `[api/quote-requests] write failed: ${
          created.reason === "db_error" ? created.detail : created.reason
        }`,
      );
      return json({ error: "write_failed" }, 503);
    }

    const written = await insertQuoteRequestLines(created.id, lines);
    if (!written.ok) {
      await deleteQuoteRequest(created.id);
      console.error(`[api/quote-requests] line write failed: ${written.detail}`);
      return json({ error: "write_failed" }, 503);
    }

    return json({ ref: created.ref }, 201);
  } catch (error) {
    console.error("[api/quote-requests] POST threw:", error);
    return json({ error: "write_failed" }, 503);
  }
}
