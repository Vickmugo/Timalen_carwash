/**
 * =====================================================================
 * STAFF WALK-INS — the rules, with no database and no server imports.
 * ---------------------------------------------------------------------
 * A car that has arrived (or was washed earlier today) is registered from
 * /admin with no time slot. It is an ordinary `bookings` row with
 * `source = 'staff'`, priced from the live price book and paid through
 * the same payments and receipts as every other booking.
 *
 * Everything that decides what is stored lives here, so tests/walkin.test.ts
 * can run it at fixed instants against an in-memory store. The route
 * (src/app/api/admin/walkins/route.ts) only wires in the session, the
 * price book and the real store (src/lib/walkins-db.ts).
 *
 * WHAT A WALK-IN IS EXEMPT FROM, AND WHAT IT IS NOT.
 *   Exempt     the lead time, the slot grid, the 14-day window and the
 *              3-upcoming-bookings-per-phone cap. The car is already here.
 *              Never refused for overlapping another booking either.
 *   Not exempt it blocks overlapping ONLINE slots, because the online
 *              checks read every booking that is not cancelled; its price
 *              and duration come from the server, never the body; and the
 *              name on it comes from the staff session, never the body.
 *
 * TIMES ARE NAIROBI WALL-CLOCK (src/lib/nairobi-time.ts). The date is
 * always today at the yard. `created_at` records when it was really
 * entered, so a start time well before it shows the entry was backdated.
 * =====================================================================
 */

import { operatingHours } from "@/data/business";
import { getFlatVehicle, getVehicleType, washPriceRows } from "@/data/services";
import { flatVehicleLines, subsumption, toLines, withoutCovered } from "@/lib/booking";
import { minutesToTime, timeToMinutes } from "@/lib/format";
import { nairobiNow } from "@/lib/nairobi-time";
import { holdMinutesFor } from "@/lib/slots";
import { cleanCustomerName, cleanText } from "@/lib/clean-text";
import { canonicalKenyanPhone } from "@/lib/validate";
import { OUTSIDE_HOURS_MESSAGE, PLATE_MAX, WALKIN_DEFAULT_NAME } from "@/lib/walkin-text";
import type {
  Booking,
  BookingLine,
  BookingSource,
  BookingVehicleId,
  JobStatus,
  PriceBook,
  WeekdayIndex,
} from "@/types";

export { OUTSIDE_HOURS_MESSAGE, PLATE_MAX, WALKIN_DEFAULT_NAME };

/** A clock a minute or two fast must not refuse "Now". */
export const FUTURE_TOLERANCE_MINUTES = 5;

/** 23:59. `bookings_time_order` needs end > start, so nothing ends later. */
const LAST_MINUTE = 23 * 60 + 59;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/* ------------------------------------------------------------------ */
/* The phone cap                                                       */
/* ------------------------------------------------------------------ */

/**
 * Whether a booking row counts toward the online 3-upcoming-per-phone cap.
 * Walk-ins never do; see `countUpcomingBookingsForPhone`.
 */
export function countsTowardPhoneCap(row: { source?: BookingSource | string | null }): boolean {
  return row.source !== "staff";
}

/* ------------------------------------------------------------------ */
/* The body                                                            */
/* ------------------------------------------------------------------ */

export interface WalkinRequest {
  walkinRequestId: string;
  vehicleTypeId: string;
  serviceIds: string[];
  customerName: string;
  /** Canonical "07…"/"01…", or "" when not given. */
  phone: string;
  /** Upper-case, single-spaced, capped; "" when not given. */
  plate: string;
  /** "HH:MM", or null for now. */
  serviceTime: string | null;
  alreadyDone: boolean;
  confirmOutsideHours: boolean;
}

export type ParsedWalkin = { ok: true; request: WalkinRequest } | { ok: false; detail: string };

/** "  kda 123x " -> "KDA 123X". */
export function cleanPlate(raw: unknown): string {
  return cleanText(raw).toUpperCase().replace(/\s+/g, " ").slice(0, PLATE_MAX).trim();
}

/**
 * Reads only the fields below. An amount, a price, a status or a staff
 * name in the body is never looked at.
 */
export function parseWalkinBody(raw: unknown): ParsedWalkin {
  const body = (raw ?? {}) as Record<string, unknown>;

  const walkinRequestId = typeof body.walkinRequestId === "string" ? body.walkinRequestId.trim() : "";
  if (!UUID.test(walkinRequestId)) {
    return { ok: false, detail: "This form is out of date. Close it and open it again." };
  }

  const vehicleTypeId = typeof body.vehicleTypeId === "string" ? body.vehicleTypeId.trim() : "";
  const serviceIds = Array.isArray(body.serviceIds)
    ? [...new Set(body.serviceIds.filter((id): id is string => typeof id === "string"))]
    : [];

  const typedPhone = cleanText(body.phone);
  let phone = "";
  if (typedPhone) {
    const canonical = canonicalKenyanPhone(typedPhone);
    if (!canonical) {
      return { ok: false, detail: "That phone number is not valid. Leave it blank if they have none." };
    }
    phone = canonical;
  }

  let serviceTime: string | null = null;
  if (body.serviceTime !== undefined && body.serviceTime !== null && body.serviceTime !== "") {
    if (typeof body.serviceTime !== "string" || !HH_MM.test(body.serviceTime.trim())) {
      return { ok: false, detail: "Enter the time as HH:MM." };
    }
    serviceTime = body.serviceTime.trim();
  }

  return {
    ok: true,
    request: {
      walkinRequestId: walkinRequestId.toLowerCase(),
      vehicleTypeId,
      serviceIds,
      customerName: cleanCustomerName(body.customerName) || WALKIN_DEFAULT_NAME,
      phone,
      plate: cleanPlate(body.plate),
      serviceTime,
      alreadyDone: body.alreadyDone === true,
      confirmOutsideHours: body.confirmOutsideHours === true,
    },
  };
}

/* ------------------------------------------------------------------ */
/* The price                                                           */
/* ------------------------------------------------------------------ */

export type PricedWalkin =
  | {
      ok: true;
      vehicleTypeId: BookingVehicleId;
      vehicleTypeName: string;
      lines: BookingLine[];
      priceKes: number;
      durationMinutes: number;
    }
  | { ok: false; detail: string };

/**
 * The same steps, in the same order, as POST /api/bookings: a flat vehicle
 * takes exactly one size; a grid column drops covered services and prices
 * the rest with `toLines`, which never charges an unread cell.
 */
export function priceWalkin(
  book: PriceBook,
  vehicleTypeId: string,
  serviceIds: readonly string[],
): PricedWalkin {
  const pricedAs = getVehicleType(vehicleTypeId) ?? getFlatVehicle(vehicleTypeId);
  if (!pricedAs) return { ok: false, detail: "Pick a vehicle type." };

  const requested = new Set(serviceIds);
  if (requested.size === 0) return { ok: false, detail: "Pick at least one service." };

  let lines: BookingLine[];
  if ("groupId" in pricedAs) {
    lines = requested.size === 1 ? flatVehicleLines(book, pricedAs, [...requested][0]) : [];
  } else {
    const { covered } = subsumption(washPriceRows, requested);
    lines = toLines(washPriceRows, book, withoutCovered(requested, covered), pricedAs.id);
  }
  if (lines.length === 0) {
    return { ok: false, detail: "None of those services have a listed price for that vehicle." };
  }

  return {
    ok: true,
    vehicleTypeId: pricedAs.id,
    vehicleTypeName: pricedAs.name,
    lines,
    priceKes: lines.reduce((total, line) => total + line.priceKes, 0),
    durationMinutes: holdMinutesFor(pricedAs.id),
  };
}

/** Whether a price section the walk-in needs could not be read. */
export function sectionFor(vehicleTypeId: string): "flat" | "wash" {
  return getFlatVehicle(vehicleTypeId) ? "flat" : "wash";
}

/* ------------------------------------------------------------------ */
/* The time                                                            */
/* ------------------------------------------------------------------ */

export type PlannedTime =
  | { ok: true; date: string; startTime: string; endTime: string; outsideHours: boolean }
  | { ok: false; error: "future" | "outside_hours"; detail: string };

/** Outside the configured hours for that day, a closed day included. */
export function isOutsideHours(weekday: number, minutes: number): boolean {
  const hours = operatingHours[weekday as WeekdayIndex];
  return (
    hours.closed || minutes < timeToMinutes(hours.open) || minutes >= timeToMinutes(hours.close)
  );
}

/**
 * Today in Nairobi, at `serviceTime` or now. Never in the future (beyond
 * the tolerance) and never before 00:00 today: a time later than now is
 * refused rather than read as yesterday. End is start plus the hold,
 * clamped to 23:59; a start at 23:59 itself moves to 23:58 so the end can
 * still be later. Outside opening hours is refused unless confirmed.
 */
export function planWalkinTime(input: {
  serviceTime: string | null;
  durationMinutes: number;
  confirmOutsideHours: boolean;
  now: Date;
}): PlannedTime {
  const today = nairobiNow(input.now);
  let start = input.serviceTime === null ? today.minutes : timeToMinutes(input.serviceTime);

  if (start > today.minutes + FUTURE_TOLERANCE_MINUTES) {
    return {
      ok: false,
      error: "future",
      detail: "That time has not happened yet today. Pick Now, or a time before now.",
    };
  }

  const outsideHours = isOutsideHours(today.weekday, start);
  if (outsideHours && !input.confirmOutsideHours) {
    return { ok: false, error: "outside_hours", detail: OUTSIDE_HOURS_MESSAGE };
  }

  start = Math.min(start, LAST_MINUTE - 1);
  const end = Math.min(start + input.durationMinutes, LAST_MINUTE);
  return {
    ok: true,
    date: today.dateKey,
    startTime: minutesToTime(start),
    endTime: minutesToTime(end),
    outsideHours,
  };
}

/* ------------------------------------------------------------------ */
/* Registering one                                                     */
/* ------------------------------------------------------------------ */

/** What the store writes. The ref and `created_at` are the store's. */
export interface WalkinRecord {
  walkinRequestId: string;
  vehicleTypeId: BookingVehicleId;
  vehicleTypeName: string;
  lines: BookingLine[];
  priceKes: number;
  durationMinutes: number;
  date: string;
  startTime: string;
  endTime: string;
  customerName: string;
  phone: string;
  /** The plate, in `bookings.vehicle`. */
  vehicle: string;
  jobStatus: Extract<JobStatus, "booked" | "done">;
}

export type WalkinInsertResult =
  | { ok: true; booking: Booking }
  /** The unique index on walkin_request_id fired: a retry raced the first. */
  | { ok: false; reason: "duplicate_request" }
  | { ok: false; reason: "db_error"; detail: string };

export interface WalkinStore {
  findByRequestId(walkinRequestId: string): Promise<Booking | null>;
  /** `by` is stamped on the `walk_in_registered` status change. */
  insert(record: WalkinRecord, by: string): Promise<WalkinInsertResult>;
}

export interface WalkinOutcome {
  status: number;
  body: Record<string, unknown>;
}

/**
 * The whole POST, minus HTTP. `staff` is the signed session or null;
 * `readPrices` is the live price book read.
 */
export async function registerWalkin(input: {
  staff: { name: string } | null;
  body: unknown;
  now: Date;
  readPrices: () => Promise<{ book: PriceBook; unavailable: string[] }>;
  store: WalkinStore;
}): Promise<WalkinOutcome> {
  if (!input.staff) return { status: 401, body: { error: "not_authorised" } };
  // From the signed session, never the body. Self-reported at sign-in.
  const by = input.staff.name;

  const parsed = parseWalkinBody(input.body);
  if (!parsed.ok) return { status: 400, body: { error: "bad_request", detail: parsed.detail } };
  const request = parsed.request;

  // A retry of a request that already landed gets the same booking back.
  const existing = await input.store.findByRequestId(request.walkinRequestId);
  if (existing) return { status: 200, body: { booking: existing, replayed: true } };

  const { book, unavailable } = await input.readPrices();
  if (unavailable.includes(sectionFor(request.vehicleTypeId))) {
    return { status: 503, body: { error: "read_failed", detail: "Prices could not be read. Try again." } };
  }
  const priced = priceWalkin(book, request.vehicleTypeId, request.serviceIds);
  if (!priced.ok) return { status: 400, body: { error: "bad_request", detail: priced.detail } };

  const time = planWalkinTime({
    serviceTime: request.serviceTime,
    durationMinutes: priced.durationMinutes,
    confirmOutsideHours: request.confirmOutsideHours,
    now: input.now,
  });
  if (!time.ok) {
    return { status: time.error === "outside_hours" ? 409 : 400, body: { error: time.error, detail: time.detail } };
  }

  const record: WalkinRecord = {
    walkinRequestId: request.walkinRequestId,
    vehicleTypeId: priced.vehicleTypeId,
    vehicleTypeName: priced.vehicleTypeName,
    lines: priced.lines,
    priceKes: priced.priceKes,
    durationMinutes: priced.durationMinutes,
    date: time.date,
    startTime: time.startTime,
    endTime: time.endTime,
    customerName: request.customerName,
    phone: request.phone,
    vehicle: request.plate,
    jobStatus: request.alreadyDone ? "done" : "booked",
  };

  const inserted = await input.store.insert(record, by);
  if (inserted.ok) return { status: 201, body: { booking: inserted.booking } };
  if (inserted.reason === "duplicate_request") {
    const first = await input.store.findByRequestId(request.walkinRequestId);
    if (first) return { status: 200, body: { booking: first, replayed: true } };
  } else {
    // Logged, not returned: a database message names columns and constraints.
    console.error(`[walkins] insert failed: ${inserted.detail}`);
  }
  return {
    status: 503,
    body: { error: "write_failed", detail: "That did not save. Nothing was registered — try again." },
  };
}
