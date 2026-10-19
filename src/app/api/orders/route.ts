import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COLLECT_FROM_YARD } from "@/data/config";
import { getProductById } from "@/data/products";
import { cartLineKey } from "@/lib/cart-line";
import { createOrder, listOrders } from "@/lib/orders-db";
import { CODE_ALREADY_USED, parsePaymentChoice } from "@/lib/payments";
import { isCodeInUse } from "@/lib/payments-db";
import { productPrice } from "@/lib/prices";
import { readPriceBook } from "@/lib/prices-db";
import { cartSubtotal, evaluateCart } from "@/lib/quote";
import { isStaffRequest } from "@/lib/staff-guard";
import { cleanCustomerName, cleanText, readJsonBody } from "@/lib/request-body";
import { LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { isValidKenyanPhone } from "@/lib/validate";
import type { CartLine } from "@/types";

/**
 * =====================================================================
 * /api/orders — concrete product orders.
 * ---------------------------------------------------------------------
 *   POST  place one. Public — this is the checkout.
 *   GET   every order. STAFF ONLY: names and phone numbers.
 *
 * SAME SECURITY MODEL AS /api/bookings. The browser sends WHAT is in the
 * basket — product ids, heights or lengths, quantities — and the server
 * prices every line from the live price book and adds them up itself. The
 * figures in the visitor's cart (which copied the price when the item was
 * added, see src/lib/cart.ts) are never read: a tampered price, or a
 * basket left open overnight across a price change, is charged today's
 * figure. The customer is shown what was stored.
 *
 * Over-threshold baskets (bulk, quote-only, a stale line with no height)
 * are refused here as well as in the browser, using the same
 * `evaluateCart`: they go to a quote, and quotes are not touched by this.
 * =====================================================================
 */

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/** A bound on a public form; the bulk rule routes anything near it to a quote anyway. */
const MAX_LINES = 30;
const MAX_QUANTITY = 10_000;


/* ------------------------------------------------------------------ */
/* GET — the staff list                                                */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  if (!isStaffRequest(request)) return json({ error: "not_authorised" }, 401);
  try {
    return json({ orders: await listOrders() }, 200);
  } catch (error) {
    console.error("[api/orders] GET failed:", error);
    return json({ error: "read_failed" }, 503);
  }
}

/* ------------------------------------------------------------------ */
/* POST — a customer checks out                                        */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, LIMITS.orderCreate);
  if (!limited.allowed) return tooManyRequests(limited);

  const parsed = await readJsonBody<{
    lines?: unknown;
    customerName?: unknown;
    phone?: unknown;
    notes?: unknown;
    payment?: unknown;
  } | null>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body ?? {};

  const requested = Array.isArray(body.lines) ? body.lines.slice(0, MAX_LINES + 1) : [];
  if (requested.length === 0) {
    return json({ error: "bad_request", detail: "Your cart is empty." }, 400);
  }
  if (requested.length > MAX_LINES) {
    return json({ error: "needs_quote", detail: "That many items needs a quote." }, 400);
  }

  /*
    THE PRICES COME FROM THE DATABASE, READ NOW. A product section that
    cannot be read refuses the order rather than pricing it as "not
    listed" — the same rule /api/bookings applies to the wash board.
  */
  const { book, unavailable } = await readPriceBook();
  if (unavailable.includes("product")) {
    return json({ error: "read_failed" }, 503);
  }

  const lines: CartLine[] = [];
  const seen = new Set<string>();
  for (const entry of requested) {
    const { productId, variantId, quantity } = (entry ?? {}) as {
      productId?: unknown;
      variantId?: unknown;
      quantity?: unknown;
    };
    const product = typeof productId === "string" ? getProductById(productId) : undefined;
    if (!product) {
      return json({ error: "bad_request", detail: "One of those items is not in our catalogue." }, 400);
    }
    if (product.quoteOnly) {
      return json({ error: "needs_quote", detail: `${product.name} is priced by quote.` }, 400);
    }
    // A product sold in sizes must name one of its own; a single-price
    // product must name none. Same rule as /api/prices.
    const variant =
      typeof variantId === "string" && variantId
        ? product.variants?.find((candidate) => candidate.id === variantId)
        : undefined;
    if (product.variants ? !variant : typeof variantId === "string" && variantId !== "") {
      return json(
        { error: "bad_request", detail: `Choose a size for ${product.name}.` },
        400,
      );
    }
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY
    ) {
      return json({ error: "bad_request", detail: "Quantities must be whole numbers." }, 400);
    }
    const key = cartLineKey({ productId: product.id, variantId: variant?.id });
    if (seen.has(key)) {
      return json({ error: "bad_request", detail: "The same item appears twice." }, 400);
    }
    seen.add(key);

    const priceKes = productPrice(book, product.id, variant?.id);
    if (priceKes === null) {
      return json(
        {
          error: "price_not_listed",
          detail: `${product.name}${variant ? `, ${variant.label}` : ""} has no listed price right now. Remove it, or ask the yard.`,
        },
        400,
      );
    }

    lines.push({
      productId: product.id,
      ...(variant ? { variantId: variant.id, variantLabel: variant.label } : {}),
      slug: product.slug,
      name: product.name,
      unitLabel: product.unitLabel,
      priceKes,
      quantity,
      status: product.status,
      quoteOnly: product.quoteOnly,
    });
  }

  // Bulk and total thresholds, on the SERVER-priced lines.
  const evaluation = evaluateCart(lines);
  if (evaluation.requiresQuote) {
    return json({ error: "needs_quote", detail: evaluation.reasons.join(" ") }, 400);
  }
  const subtotalKes = cartSubtotal(lines);

  /* ---- who ---- */
  const customerName = cleanCustomerName(body.customerName);
  const phone = cleanText(body.phone);
  const notes = cleanText(body.notes);
  if (!customerName) {
    return json({ error: "bad_request", detail: "Name is required." }, 400);
  }
  if (!isValidKenyanPhone(phone)) {
    return json({ error: "bad_request", detail: "That phone number is not valid." }, 400);
  }

  /* ---- how they will pay: M-Pesa to the paybill, or cash at collection ---- */
  const parsedPayment = parsePaymentChoice(body.payment, "concrete");
  if (!parsedPayment.ok) {
    return json({ error: "bad_request", detail: parsedPayment.detail }, 400);
  }
  const payment = parsedPayment.choice;

  if (payment.mpesaCode) {
    try {
      if (await isCodeInUse(payment.mpesaCode)) {
        return json({ error: "code_used", detail: CODE_ALREADY_USED }, 409);
      }
    } catch (error) {
      console.error("[api/orders] code check failed:", error);
      return json({ error: "read_failed" }, 503);
    }
  }

  try {
    const result = await createOrder({
      lines,
      subtotalKes,
      customerName,
      phone,
      collection: COLLECT_FROM_YARD,
      notes,
      payment,
    });
    // The ref only, as for bookings: /checkout/confirmed reads the public view.
    if (result.ok) return json({ order: { ref: result.order.ref } }, 201);
    if (result.reason === "code_used") {
      return json({ error: "code_used", detail: CODE_ALREADY_USED }, 409);
    }
    console.error(
      `[api/orders] write failed: ${result.reason === "db_error" ? result.detail : result.reason}`,
    );
    return json({ error: "write_failed" }, 503);
  } catch (error) {
    console.error("[api/orders] POST threw:", error);
    return json({ error: "write_failed" }, 503);
  }
}
