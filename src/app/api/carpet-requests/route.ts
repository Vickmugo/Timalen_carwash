import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  CARPET_MAX_PER_ITEM,
  CARPET_HANDOVER_TEXT,
  CARPET_REF_PREFIX,
  carpetEstimate,
  carpetFullyPriced,
  carpetItemText,
  carpetPricedLines,
  carpetQuantityText,
  carpetRows,
  type CarpetPick,
} from "@/lib/carpet-request";
import { readPriceBook } from "@/lib/prices-db";
import { createQuoteRequest, listQuoteRequests } from "@/lib/quote-requests-db";
import { isStaffRequest } from "@/lib/staff-guard";
import { cleanCustomerName, cleanText, readJsonBody } from "@/lib/request-body";
import { LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { isValidKenyanPhone } from "@/lib/validate";
import { CODE_ALREADY_USED, parsePaymentChoice } from "@/lib/payments";
import { insertPayment, isCodeInUse } from "@/lib/payments-db";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";

/**
 * =====================================================================
 * /api/carpet-requests — carpets and sofa sets, brought to the yard.
 * ---------------------------------------------------------------------
 *   POST  one request. Public — this is the customer's form.
 *   GET   every carpet request. STAFF ONLY: names and phone numbers.
 *
 * NO SLOT, NO VEHICLE. A carpet does not occupy the wash bay
 * for a window of time, so this never reads or writes a booking. The
 * customer brings everything to the yard and collects it from there —
 * there is no collection service, so no address is asked for or stored.
 * Staff ring when the work is ready.
 *
 * PAYMENT: M-Pesa to the wash till, or cash at the yard, recorded as a
 * `payments` row against the request (stream `wash`, receipt series W).
 * M-Pesa is accepted only when every line has a price on the board; with
 * an unpriced line (a sofa set while it has no figure) there is no amount
 * to pay against, so only cash is accepted and the price is confirmed at
 * the yard. The expected amount is the server's sum of the priced lines.
 *
 * Stored in `quote_requests` — see src/lib/quote-requests-db.ts for why
 * that table, and why header rows only.
 * =====================================================================
 */

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}



/* ------------------------------------------------------------------ */
/* GET — the staff list                                                */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  if (!isStaffRequest(request)) return json({ error: "not_authorised" }, 401);

  try {
    return json({ requests: await listQuoteRequests(CARPET_REF_PREFIX) }, 200);
  } catch (error) {
    console.error("[api/carpet-requests] GET failed:", error);
    return json({ error: "read_failed" }, 503);
  }
}

/* ------------------------------------------------------------------ */
/* POST — a customer sends one                                         */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, LIMITS.carpetCreate);
  if (!limited.allowed) return tooManyRequests(limited);

  const parsed = await readJsonBody<{
    items?: unknown;
    customerName?: unknown;
    phone?: unknown;
    notes?: unknown;
    payment?: unknown;
  } | null>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body ?? {};

  /*
    WHAT IS COMING. Each id must be a size on the board's carpet group, and
    each quantity a whole number from 1 to the bound. Checked against the
    data file here rather than trusted, for the same reason the booking
    route checks service ids: an unknown id would be stored as a request
    for something the yard does not list.
  */
  const known = new Set(carpetRows().map((row) => row.id));
  const picks: CarpetPick[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(body.items) ? body.items : []) {
    const { id, quantity } = (entry ?? {}) as { id?: unknown; quantity?: unknown };
    if (
      typeof id !== "string" ||
      !known.has(id) ||
      seen.has(id) ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > CARPET_MAX_PER_ITEM
    ) {
      return json(
        { error: "bad_request", detail: "One of those items is not something we take." },
        400,
      );
    }
    seen.add(id);
    picks.push({ id, quantity });
  }
  if (picks.length === 0) {
    return json({ error: "bad_request", detail: "Pick at least one item." }, 400);
  }
  // Board order, so every stored request reads the same way round.
  const order = carpetRows().map((row) => row.id);
  picks.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

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

  /*
    THE FIGURES ARE READ HERE, like a booking's, so the stored request says
    what the board said when it arrived — not what the customer's page was
    rendered with. Unlike a booking, an unreadable board does not refuse
    the request: nothing is charged here, and turning away someone who only
    wants a call back would be the worse failure. The lines say the price
    was not read instead of pretending to know it.
  */
  const { book, unavailable } = await readPriceBook();
  const pricesRead = !unavailable.includes("flat");

  /*
    M-PESA NEEDS A KNOWN TOTAL. If the board could not be read, or any line
    has no figure, the only accepted choice is cash at the yard. The amount
    recorded is the server's own sum of the priced lines — zero when the
    board is unreadable — and staff take the real figure at the counter.
  */
  const mpesaAllowed = pricesRead && carpetFullyPriced(book, picks);
  const parsedPayment = parsePaymentChoice(body.payment, "wash", mpesaAllowed);
  if (!parsedPayment.ok) {
    return json({ error: "bad_request", detail: parsedPayment.detail }, 400);
  }
  const payment = parsedPayment.choice;
  const amountKes = pricesRead ? carpetEstimate(book, picks).pricedKes : 0;

  if (payment.mpesaCode) {
    try {
      if (await isCodeInUse(payment.mpesaCode)) {
        return json({ error: "code_used", detail: CODE_ALREADY_USED }, 409);
      }
    } catch (error) {
      console.error("[api/carpet-requests] code check failed:", error);
      return json({ error: "read_failed" }, 503);
    }
  }

  try {
    const result = await createQuoteRequest({
      refPrefix: CARPET_REF_PREFIX,
      customerName,
      phone,
      item: carpetItemText(book, picks, pricesRead),
      quantity: carpetQuantityText(picks),
      // Always the same now: everything is brought in and collected from
      // the yard. Older CP- rows still carry "Collect from: ..." or
      // "Drop-off at the yard" and the staff list shows them as stored.
      deliveryLocation: CARPET_HANDOVER_TEXT,
      notes,
      pricedLines: pricesRead ? carpetPricedLines(book, picks) : [],
    });

    if (result.ok) {
      const paid = await insertPayment(
        { quoteRequestId: result.id },
        "wash",
        payment,
        amountKes,
      );
      if (!paid.ok) {
        // Compensating delete, as for bookings: a request with no payment
        // record would sit in the list with nothing for staff to check.
        await getSupabaseServiceRoleClient()
          .from("quote_requests")
          .delete()
          .eq("id", result.id);
        if (paid.reason === "code_used") {
          return json({ error: "code_used", detail: CODE_ALREADY_USED }, 409);
        }
        console.error(`[api/carpet-requests] payment write failed: ${paid.detail}`);
        return json({ error: "write_failed" }, 503);
      }
      return json({ ref: result.ref, amountKes, method: payment.method }, 201);
    }

    console.error(
      `[api/carpet-requests] write failed: ${
        result.reason === "db_error" ? result.detail : result.reason
      }`,
    );
    return json({ error: "write_failed" }, 503);
  } catch (error) {
    console.error("[api/carpet-requests] POST threw:", error);
    return json({ error: "write_failed" }, 503);
  }
}
