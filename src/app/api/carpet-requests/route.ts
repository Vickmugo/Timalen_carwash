import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  CARPET_MAX_PER_ITEM,
  CARPET_REF_PREFIX,
  carpetItemText,
  carpetQuantityText,
  carpetRows,
  type CarpetPick,
} from "@/lib/carpet-request";
import { readPriceBook } from "@/lib/prices-db";
import { createQuoteRequest, listQuoteRequests } from "@/lib/quote-requests-db";
import { isStaffRequest } from "@/lib/staff-guard";
import { isValidKenyanPhone } from "@/lib/validate";

/**
 * =====================================================================
 * /api/carpet-requests — carpets and sofa sets, dropped off or collected.
 * ---------------------------------------------------------------------
 *   POST  one request. Public — this is the customer's form.
 *   GET   every carpet request. STAFF ONLY: names and phone numbers.
 *
 * NO SLOT, NO VEHICLE, NO PAYMENT. A carpet does not occupy the wash bay
 * for a window of time, so this never reads or writes a booking. The
 * request says what is coming and how; staff ring back to arrange when.
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

/** Longest free text accepted in any one field. A public form's bound. */
const MAX_TEXT = 500;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "";
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
  let body: {
    items?: unknown;
    customerName?: unknown;
    phone?: unknown;
    handover?: unknown;
    collectFrom?: unknown;
    notes?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "bad_request", detail: "Body is not JSON." }, 400);
  }

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

  /* ---- who, and how it reaches the yard ---- */
  const customerName = asText(body.customerName);
  const phone = asText(body.phone);
  const collectFrom = asText(body.collectFrom);
  const notes = asText(body.notes);

  if (!customerName) {
    return json({ error: "bad_request", detail: "Name is required." }, 400);
  }
  if (!isValidKenyanPhone(phone)) {
    return json({ error: "bad_request", detail: "That phone number is not valid." }, 400);
  }
  if (body.handover !== "dropoff" && body.handover !== "collect") {
    return json(
      { error: "bad_request", detail: "Say whether you will drop off or want collection." },
      400,
    );
  }
  if (body.handover === "collect" && !collectFrom) {
    return json(
      { error: "bad_request", detail: "Say where we should collect from." },
      400,
    );
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

  try {
    const result = await createQuoteRequest({
      refPrefix: CARPET_REF_PREFIX,
      customerName,
      phone,
      item: carpetItemText(book, picks, pricesRead),
      quantity: carpetQuantityText(picks),
      deliveryLocation:
        body.handover === "collect"
          ? `Collect from: ${collectFrom}`
          : "Drop-off at the yard",
      notes,
    });

    if (result.ok) return json({ ref: result.ref }, 201);

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
