import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getFlatVehicle, getVehicleType, washPriceRows } from "@/data/services";
import { readPriceBook } from "@/lib/prices-db";
import { flatVehicleLines, subsumption, toLines, withoutCovered } from "@/lib/booking";
import { createBooking, listBookings } from "@/lib/bookings-db";
import type { NewBookingInput } from "@/lib/bookings-db";
import { getBookedIntervals } from "@/lib/bookings-db";
import { generateSlots, getBookableDates, holdMinutesFor } from "@/lib/slots";
import { isStaffRequest } from "@/lib/staff-guard";
import { isValidKenyanPhone } from "@/lib/validate";
import type { BookingLine, PaymentStatus } from "@/types";

/**
 * =====================================================================
 * /api/bookings — the whole booking table, and the way a new one is made.
 * ---------------------------------------------------------------------
 *   GET   every booking. STAFF ONLY.
 *   POST  create one. Public — this is the customer's booking form.
 *
 * THE SUPABASE BOUNDARY. Both verbs reach the database through
 * src/lib/bookings-db.ts, which uses the service-role key. That key never
 * leaves the server and the browser never talks to Supabase directly:
 * grants and RLS are locked to service_role by design, so an anon-key call
 * from the client would be refused anyway. This route IS the client's
 * access to bookings.
 * =====================================================================
 */

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  // Customer names and phone numbers. Never held by a shared cache, and
  // never replayed from a browser's back-forward cache either.
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/* ------------------------------------------------------------------ */
/* GET — the staff table                                               */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  if (!isStaffRequest(request)) {
    return json({ error: "not_authorised" }, 401);
  }

  try {
    return json({ bookings: await listBookings() }, 200);
  } catch (error) {
    console.error("[api/bookings] GET failed:", error);
    // The message is logged, not returned: a database error can name
    // columns and constraints, and this response goes to a browser.
    return json({ error: "read_failed" }, 503);
  }
}

/* ------------------------------------------------------------------ */
/* POST — a customer books a slot                                      */
/* ------------------------------------------------------------------ */

/**
 * WHAT THE BROWSER IS ALLOWED TO DECIDE.
 *
 * Not much, and deliberately. The form sends WHAT was chosen — a vehicle
 * type, some service ids, a day and a start time — and the server works
 * out what that costs and how long it takes.
 *
 * The alternative, taking `priceKes` and `lines` from the request the way
 * the localStorage version did, would mean the price of a wash is whatever
 * the browser says it is. That was harmless while the record lived in the
 * customer's own browser and only they could read it. It stops being
 * harmless the moment the record is a real row on a real server that staff
 * work from and print receipts off.
 *
 * So the price book is read HERE, on the server, from the database, with
 * the same functions the picker uses — including the subsumption rule, so a
 * service already covered by another cannot be charged twice. Since prices
 * became live-editable this is also what guarantees a booking is written at
 * the CURRENT figure rather than whatever the customer's page was rendered
 * with an hour ago.
 */
interface BookingRequestBody {
  vehicleTypeId?: unknown;
  serviceIds?: unknown;
  date?: unknown;
  startTime?: unknown;
  customerName?: unknown;
  phone?: unknown;
  vehicle?: unknown;
  notes?: unknown;
  paymentStatus?: unknown;
}

const PAYMENT_STATUSES: PaymentStatus[] = [
  "paid",
  "pay_on_collection",
  "unpaid",
];

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  let body: BookingRequestBody;
  try {
    body = (await request.json()) as BookingRequestBody;
  } catch {
    return json({ error: "bad_request", detail: "Body is not JSON." }, 400);
  }

  /* ---- the vehicle: a grid column, or a flat-priced vehicle ---- */
  const vehicleTypeId = asTrimmedString(body.vehicleTypeId);
  const pricedAs = getVehicleType(vehicleTypeId) ?? getFlatVehicle(vehicleTypeId);
  if (!pricedAs) {
    return json(
      { error: "bad_request", detail: "Unknown vehicle type." },
      400,
    );
  }

  /* ---- the services, priced from the board rather than from the body ---- */
  const requestedIds = Array.isArray(body.serviceIds)
    ? new Set(body.serviceIds.filter((id): id is string => typeof id === "string"))
    : new Set<string>();

  if (requestedIds.size === 0) {
    return json(
      { error: "bad_request", detail: "Choose at least one service." },
      400,
    );
  }

  /*
    THE PRICES COME FROM THE DATABASE, READ HERE, AT SUBMIT TIME.

    This is the line that makes live price editing real rather than
    cosmetic. The browser sent service ids and a vehicle column; the
    figures attached to them are fetched now, from `service_prices`, so a
    price the yard changed thirty seconds ago is the price this booking is
    written at.

    It also closes the obvious hole in the other direction: a customer who
    left the booking form open for an hour is charged today's price, not
    the one their page was rendered with. Neither side's copy is trusted —
    the total is computed here or not at all.
  */
  const { book: priceBook, unavailable } = await readPriceBook();
  if (unavailable.includes("groupId" in pricedAs ? "flat" : "wash")) {
    // Refuse rather than price from the section this booking needs when it
    // could not be read. The pages render an unreadable section as "not
    // listed", which is fine for a page; here it would drop every line and
    // tell the customer their selection has no listed price — a lie about
    // the yard rather than a report of a broken database. The sections a
    // booking does not use play no part, so their failures do not block it.
    return json({ error: "read_failed" }, 503);
  }

  let lines: BookingLine[];
  if ("groupId" in pricedAs) {
    // ONE SIZE, ONE LINE. A flat vehicle is priced as the size being
    // brought, so exactly one id is accepted — two would be two vehicles
    // in one slot. `flatVehicleLines` drops a size that is not this
    // vehicle's, or whose figure is unread.
    lines =
      requestedIds.size === 1
        ? flatVehicleLines(priceBook, pricedAs, [...requestedIds][0])
        : [];
  } else {
    // The same two steps the picker runs, in the same order: drop anything
    // already covered by another selected service, then price what is left.
    // `toLines` also drops any row whose board cell has never been read, so
    // an unpriced service can never reach a booking as a zero.
    const { covered } = subsumption(washPriceRows, requestedIds);
    const chargeable = withoutCovered(requestedIds, covered);
    lines = toLines(washPriceRows, priceBook, chargeable, pricedAs.id);
  }

  if (lines.length === 0) {
    return json(
      {
        error: "bad_request",
        detail: "None of those services have a listed price for that vehicle.",
      },
      400,
    );
  }

  const priceKes = lines.reduce((total, line) => total + line.priceKes, 0);
  // A lorry or bus holds the bay longer; see `holdMinutesFor`.
  const durationMinutes = holdMinutesFor(pricedAs.id);

  /* ---- the customer's details ---- */
  const customerName = asTrimmedString(body.customerName);
  const phone = asTrimmedString(body.phone);
  const vehicle = asTrimmedString(body.vehicle);
  const notes = asTrimmedString(body.notes);

  if (!customerName || !vehicle) {
    return json(
      { error: "bad_request", detail: "Name and vehicle are required." },
      400,
    );
  }
  if (!isValidKenyanPhone(phone)) {
    return json(
      { error: "bad_request", detail: "That phone number is not valid." },
      400,
    );
  }

  const paymentStatus = asTrimmedString(body.paymentStatus) as PaymentStatus;
  if (!PAYMENT_STATUSES.includes(paymentStatus)) {
    return json(
      { error: "bad_request", detail: "Unknown payment status." },
      400,
    );
  }

  /* ---- the slot, checked against the real diary ----

     The date must be inside the booking window and the start time must be
     a slot that actually exists on that day's grid AND is free. Checked
     here rather than trusted, because a start time is just a string in a
     request body: without this, a booking could be written for 03:00 on a
     Sunday, and the staff view would show it as real. */
  const date = asTrimmedString(body.date);
  const startTime = asTrimmedString(body.startTime);

  if (!getBookableDates().includes(date)) {
    return json(
      { error: "bad_request", detail: "That date is not open for booking." },
      400,
    );
  }

  let slots;
  try {
    slots = generateSlots(date, durationMinutes, await getBookedIntervals(date));
  } catch (error) {
    console.error("[api/bookings] slot lookup failed:", error);
    return json({ error: "read_failed" }, 503);
  }

  const slot = slots.find((candidate) => candidate.startTime === startTime);
  if (!slot) {
    return json(
      { error: "bad_request", detail: "That is not a valid start time." },
      400,
    );
  }
  if (!slot.available) {
    return json({ error: "slot_taken" }, 409);
  }

  /* ---- write it ---- */
  const input: NewBookingInput = {
    vehicleTypeId: pricedAs.id,
    // The column NAME is copied onto the record, not just its id. If the
    // board is ever repainted with different wording, this booking keeps
    // saying what the customer was actually quoted against.
    vehicleTypeName: pricedAs.name,
    lines,
    priceKes,
    durationMinutes,
    date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    customerName,
    phone,
    vehicle,
    notes,
    paymentStatus,
  };

  let result;
  try {
    result = await createBooking(input);
  } catch (error) {
    console.error("[api/bookings] POST threw:", error);
    return json({ error: "write_failed" }, 503);
  }

  if (result.ok) return json({ booking: result.booking }, 201);

  /*
    EVERY FAILURE BECOMES SOMETHING A CUSTOMER CAN ACT ON.

    Never a raw database message: those name columns and constraints, they
    mean nothing to somebody trying to book a car wash, and they describe
    the inside of a system to whoever else is reading. The detail is logged
    for whoever has to fix it; the customer gets a sentence.
  */
  if (result.reason === "slot_taken") {
    return json({ error: "slot_taken" }, 409);
  }

  if (result.reason === "ref_exhausted") {
    // Five collisions in a row is not bad luck, it is a broken generator.
    console.error(
      "[api/bookings] Ref generation exhausted after repeated collisions.",
    );
    return json({ error: "write_failed" }, 503);
  }

  console.error(
    `[api/bookings] Write failed (${result.code ?? "no code"}): ${result.detail}`,
  );
  return json({ error: "write_failed" }, 503);
}
