/**
 * =====================================================================
 * BOOKINGS, IN THE DATABASE — the mapping layer and every query.
 * ---------------------------------------------------------------------
 * SERVER ONLY. Every function here reaches for the service-role client,
 * which throws if this module is ever evaluated in a browser (see
 * `assertServer` in src/lib/supabase.ts). Nothing in this file may be
 * imported from a client component — the route handlers in
 * src/app/api/bookings/ are the boundary, and the browser talks to those.
 *
 * THIS IS THE MAPPING LAYER the first migration deliberately did not
 * write. Its comment said it would be built by the first feature that
 * actually needed one, and this is that feature. It exists because the two
 * sides genuinely disagree about more than capitalisation:
 *
 *   camelCase <-> snake_case   the mechanical half. `customerName` is
 *                              `customer_name`, and so on.
 *
 *   date/startTime/endTime     `date` is `booking_date` in SQL, because
 *                              `date` is also a type name there.
 *
 *   "HH:mm" <-> "HH:mm:ss"     POSTGRES `time` COMES BACK WITH SECONDS.
 *                              Every reader in this app formats times as
 *                              "HH:mm" and compares them as strings — slot
 *                              generation in src/lib/slots.ts does exactly
 *                              that — so "09:00:00" would silently fail to
 *                              match the "09:00" a slot is keyed by. The
 *                              seconds are trimmed on the way in.
 *
 *   timestamptz <-> ISO        PostgREST returns
 *                              "2026-09-07T10:55:16.204363+00:00", which is
 *                              valid but is not what `toISOString()`
 *                              produces. Normalised on the way in so every
 *                              `createdAt` in the app has one shape.
 *
 *   lines / history            arrays on one TypeScript object, two child
 *                              tables in SQL. Fetched in the same request
 *                              through PostgREST's embedding, and folded
 *                              back onto the record here.
 *
 * WHAT IS DELIBERATELY NOT HANDLED: the legacy flat-tier shape. New
 * bookings always carry `vehicleTypeId` and lines. The columns exist in
 * the schema and the mapper passes them through, but nothing written by
 * this app will ever populate them. See the note at the bottom of this
 * file.
 * =====================================================================
 */

import { BUSINESS_ID, getSupabaseServiceRoleClient } from "@/lib/supabase";
import { makeRef } from "@/lib/format";
import { canonicalKenyanPhone } from "@/lib/validate";
import {
  PAYMENT_EMBED,
  insertPayment,
  latestPayment,
  type PaymentRow,
} from "@/lib/payments-db";
import type { PaymentChoice } from "@/lib/payments";
import type {
  Booking,
  BookingLine,
  BookingVehicleId,
  JobStatus,
  PaymentStatus,
  StatusChange,
} from "@/types";

/* ------------------------------------------------------------------ */
/* Row shapes — what PostgREST actually hands back                     */
/* ------------------------------------------------------------------ */

interface BookingLineRow {
  service_id: string;
  name: string;
  price_kes: number;
  position: number;
}

interface StatusChangeRow {
  to_status: string;
  changed_by: string;
  changed_at: string;
}

interface BookingRow {
  id: string;
  ref: string;
  vehicle_type_id: string | null;
  vehicle_type_name: string | null;
  service_id: string | null;
  service_name: string | null;
  price_kes: number;
  duration_minutes: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  phone: string;
  vehicle: string;
  notes: string;
  payment_status: PaymentStatus;
  job_status: JobStatus;
  created_at: string;
  booking_lines?: BookingLineRow[] | null;
  status_changes?: StatusChangeRow[] | null;
  payments?: PaymentRow[] | null;
}

/**
 * One `select` string, used by every read below.
 *
 * The two children ride along on the same request through PostgREST's
 * embedding, which works because `booking_lines.booking_id` and
 * `status_changes.booking_id` are real foreign keys — the relationship is
 * read out of the schema rather than configured here. Three round trips
 * collapse into one, and a booking can never arrive without its lines.
 */
const BOOKING_SELECT =
  "id, ref, vehicle_type_id, vehicle_type_name, service_id, service_name, " +
  "price_kes, duration_minutes, booking_date, start_time, end_time, " +
  "customer_name, phone, vehicle, notes, payment_status, job_status, created_at, " +
  "booking_lines(service_id, name, price_kes, position), " +
  "status_changes(to_status, changed_by, changed_at), " +
  PAYMENT_EMBED;

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

/**
 * WHY THESE TWO CASTS EXIST.
 *
 * supabase-js derives its result type from the `select` STRING, and it
 * cannot parse an embedded select like `booking_lines(...)` without
 * generated database types. Given none, it widens the result to a union
 * that includes its own `GenericStringError`, which does not overlap
 * `BookingRow` — so a direct cast is rejected and it has to go through
 * `unknown`.
 *
 * Kept to these two functions rather than sprinkled at each call site, so
 * there is one place to delete when `supabase gen types` is wired up and
 * the inference starts working properly.
 */
function asRow(data: unknown): BookingRow {
  return data as BookingRow;
}

function asRows(data: unknown): BookingRow[] {
  return data as BookingRow[];
}

/**
 * "09:00:00" -> "09:00". Idempotent, so a value that already has the app's
 * shape passes through untouched.
 */
function toHhMm(time: string): string {
  return time.slice(0, 5);
}

/**
 * Postgres timestamp -> the ISO string the rest of the app uses.
 *
 * Falls back to the raw value rather than throwing on something
 * unparseable: a receipt with an odd-looking date on it is a better
 * outcome than a page that will not render at all.
 */
function toIso(timestamp: string): string {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? timestamp : parsed.toISOString();
}

/** One `booking_lines` row -> the `BookingLine` the app renders. */
function toBookingLine(row: BookingLineRow): BookingLine {
  return {
    serviceId: row.service_id,
    name: row.name,
    priceKes: row.price_kes,
  };
}

/** One `status_changes` row -> the `StatusChange` the staff view renders. */
function toStatusChange(row: StatusChangeRow): StatusChange {
  return {
    to: row.to_status,
    by: row.changed_by,
    at: toIso(row.changed_at),
  };
}

/**
 * A row (plus its embedded children) -> the `Booking` every component in
 * this app already knows how to render.
 *
 * The point of returning the existing type rather than a new one: the
 * confirmation page, the receipt and the staff table were all written
 * against `Booking` and none of them had to learn a database shape.
 */
export function toBooking(row: BookingRow): Booking {
  const lines = (row.booking_lines ?? [])
    // Board order. Rows come back in no guaranteed order, and a receipt
    // that lists services differently on each render looks broken.
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(toBookingLine);

  const history = (row.status_changes ?? [])
    // Most recent first, matching the documented order of the field.
    .slice()
    .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
    .map(toStatusChange);

  return {
    ref: row.ref,
    ...(row.vehicle_type_id
      ? { vehicleTypeId: row.vehicle_type_id as BookingVehicleId }
      : {}),
    ...(row.vehicle_type_name
      ? { vehicleTypeName: row.vehicle_type_name }
      : {}),
    ...(lines.length > 0 ? { lines } : {}),
    ...(row.service_id ? { serviceId: row.service_id } : {}),
    ...(row.service_name ? { serviceName: row.service_name } : {}),
    priceKes: row.price_kes,
    durationMinutes: row.duration_minutes,
    date: row.booking_date,
    startTime: toHhMm(row.start_time),
    endTime: toHhMm(row.end_time),
    customerName: row.customer_name,
    phone: row.phone,
    vehicle: row.vehicle,
    notes: row.notes,
    paymentStatus: row.payment_status,
    jobStatus: row.job_status,
    ...(row.payments && row.payments.length > 0
      ? { payment: latestPayment(row.payments) }
      : {}),
    createdAt: toIso(row.created_at),
    // Absent rather than empty, matching how the field reads elsewhere:
    // "nobody has touched this" is the ordinary case, not a missing value.
    ...(history.length > 0 ? { history } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

/**
 * What the booking form sends. Deliberately NOT `Booking`: the reference
 * and the timestamp are the server's to decide, not the browser's.
 */
export interface NewBookingInput {
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
  vehicle: string;
  notes: string;
  /**
   * How the customer says they will pay. Checked by `parsePaymentChoice`
   * in the route; the payment row's status and amount are decided here,
   * not by the browser.
   */
  payment: PaymentChoice;
}

/**
 * How many references to try before giving up.
 *
 * `makeRef` draws six characters from a 32-letter alphabet — about a
 * billion values — so a collision is already unlikely and two in a row is
 * vanishingly so. The retry exists because the schema was built for it:
 * `unique (business_id, ref)` turns a duplicate into a catchable error
 * instead of a silently overwritten booking, and this is the code that was
 * promised to catch it.
 *
 * Bounded rather than a `while (true)`: if every attempt collides,
 * something is wrong that retrying will not fix — a broken generator, the
 * wrong constraint firing — and a loop would hold the request open
 * forever. Five failures becomes a visible error.
 */
const REF_ATTEMPTS = 5;

/** Postgres SQLSTATE for a unique-constraint violation. */
const UNIQUE_VIOLATION = "23505";

export type CreateBookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "slot_taken" }
  | { ok: false; reason: "code_used" }
  | { ok: false; reason: "ref_exhausted" }
  | { ok: false; reason: "db_error"; detail: string; code: string | null };

/**
 * Writes one booking and its lines.
 *
 * NOT ATOMIC, and worth being plain about. PostgREST has no multi-statement
 * transaction, so this is two writes: the booking, then its lines. If the
 * lines fail, the booking that was just written is DELETED before
 * returning an error — a compensating write, so the customer never ends up
 * with a priced booking that itemises nothing.
 *
 * The real fix is a Postgres function doing both inside one transaction,
 * called over RPC. That is a schema change and therefore a separate
 * migration; it is the right next step for this path, and it is not done
 * here.
 */
export async function createBooking(
  input: NewBookingInput,
): Promise<CreateBookingResult> {
  const db = getSupabaseServiceRoleClient();

  /*
    THE SLOT CHECK, SERVER SIDE.

    The browser checks too, just before submitting, but that check is
    advisory: it runs on data the page fetched seconds earlier, and two
    customers on two phones can both pass it. This one runs against the
    database at the moment of writing, which is the only place the question
    can be answered honestly.

    It is still not a guarantee. Between this SELECT and the INSERT below
    there is a window in which another request can write the same slot.
    Closing it properly means an exclusion constraint on the table
    (`btree_gist` over business_id and the time range), which is a schema
    change and so a separate migration. For one bay taking a handful of
    bookings a day, the window is small and the failure mode is a
    double-booked slot a human sorts out — not a lost or corrupted record.
  */
  const conflict = await db
    .from("bookings")
    .select("ref, start_time, end_time")
    .eq("business_id", BUSINESS_ID)
    .eq("booking_date", input.date)
    // A cancelled booking no longer holds the bay.
    .neq("job_status", "cancelled")
    // Overlap, in the same form src/lib/slots.ts uses: two intervals
    // overlap when each starts before the other ends.
    .lt("start_time", input.endTime)
    .gt("end_time", input.startTime)
    .limit(1);

  if (conflict.error) {
    return {
      ok: false,
      reason: "db_error",
      detail: conflict.error.message,
      code: conflict.error.code ?? null,
    };
  }
  if ((conflict.data?.length ?? 0) > 0) {
    return { ok: false, reason: "slot_taken" };
  }

  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt += 1) {
    const ref = makeRef("WB");

    const inserted = await db
      .from("bookings")
      .insert({
        business_id: BUSINESS_ID,
        ref,
        vehicle_type_id: input.vehicleTypeId,
        vehicle_type_name: input.vehicleTypeName,
        price_kes: input.priceKes,
        duration_minutes: input.durationMinutes,
        booking_date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        customer_name: input.customerName,
        phone: input.phone,
        vehicle: input.vehicle,
        notes: input.notes,
        /*
          The old column, kept in step with the payment for the screens
          that still read it: nothing has been paid on a claim, and cash
          is an arrangement to pay at the bay. `resolve_payment()` moves it
          to 'paid' when staff confirm the money.
        */
        payment_status:
          input.payment.method === "cash" ? "pay_on_collection" : "unpaid",
      })
      .select("id")
      .single();

    if (inserted.error) {
      // The case this retry was built for: this ref is already taken, so
      // take a different one. Any other error is real and stops here.
      if (inserted.error.code === UNIQUE_VIOLATION) continue;
      return {
        ok: false,
        reason: "db_error",
        detail: inserted.error.message,
        code: inserted.error.code ?? null,
      };
    }

    const bookingId = inserted.data.id as string;

    if (input.lines.length > 0) {
      const lines = await db.from("booking_lines").insert(
        input.lines.map((line, index) => ({
          booking_id: bookingId,
          service_id: line.serviceId,
          name: line.name,
          price_kes: line.priceKes,
          position: index,
        })),
      );

      if (lines.error) {
        // Compensating delete. A booking with a price and no lines is a
        // record nobody can read, and leaving one behind is worse than
        // failing the request.
        await db.from("bookings").delete().eq("id", bookingId);
        return {
          ok: false,
          reason: "db_error",
          detail: lines.error.message,
          code: lines.error.code ?? null,
        };
      }
    }

    /*
      THE PAYMENT, CLAIMED OR CASH DUE, AT THE PRICE COMPUTED BY THE ROUTE.

      Same compensation as the lines: if it cannot be written, the booking
      goes too. A held slot with no payment record would sit in the diary
      looking unpaid with nothing for staff to verify. The likeliest
      failure is the code-uniqueness index — the route checks first, but
      two phones can race — and that comes back as its own reason so the
      customer is told the code is taken, not that the system failed.
    */
    const paid = await insertPayment(
      { bookingId },
      "wash",
      input.payment,
      input.priceKes,
    );
    if (!paid.ok) {
      await db.from("bookings").delete().eq("id", bookingId);
      if (paid.reason === "code_used") return { ok: false, reason: "code_used" };
      return { ok: false, reason: "db_error", detail: paid.detail, code: null };
    }

    // Read the whole thing back rather than assembling it from the input.
    // What the customer is shown is then what the database actually holds,
    // defaults and all.
    const created = await db
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("id", bookingId)
      .single();

    if (created.error) {
      return {
        ok: false,
        reason: "db_error",
        detail: created.error.message,
        code: created.error.code ?? null,
      };
    }

    return { ok: true, booking: toBooking(asRow(created.data)) };
  }

  return { ok: false, reason: "ref_exhausted" };
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

/**
 * Every booking, oldest slot first.
 *
 * Same order `getBookings` used in src/lib/store.ts — the staff diary
 * reads forwards — so the table sorts identically to before the move.
 */
export async function listBookings(): Promise<Booking[]> {
  const db = getSupabaseServiceRoleClient();

  const { data, error } = await db
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("business_id", BUSINESS_ID)
    .order("booking_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw new Error(`listBookings: ${error.message}`);
  return asRows(data).map(toBooking);
}

/** One booking by its printed reference, or null. */
export async function getBookingByRef(ref: string): Promise<Booking | null> {
  const db = getSupabaseServiceRoleClient();

  const { data, error } = await db
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("business_id", BUSINESS_ID)
    .eq("ref", ref)
    // `maybeSingle`, not `single`: a reference that matches nothing is an
    // ordinary outcome here (a mistyped URL), and `single` treats it as an
    // error.
    .maybeSingle();

  if (error) throw new Error(`getBookingByRef: ${error.message}`);
  return data ? toBooking(asRow(data)) : null;
}

/**
 * JUST THE OCCUPIED INTERVALS ON ONE DAY — no names, no phone numbers.
 *
 * This is what the public booking form needs to grey out taken slots, and
 * it is deliberately the narrowest possible answer to that question. The
 * form is an unauthenticated page; handing it whole bookings so it could
 * work out which times are free would publish the customer list of a
 * business to anybody who opened the network tab.
 *
 * The returned objects are `Booking`-shaped only as far as
 * `generateSlots` reads them — date, start, end — because that is all it
 * touches. Everything else is filled with empty values that never reach a
 * screen.
 */
export async function getBookedIntervals(date: string): Promise<Booking[]> {
  const db = getSupabaseServiceRoleClient();

  const { data, error } = await db
    .from("bookings")
    .select("booking_date, start_time, end_time")
    .eq("business_id", BUSINESS_ID)
    .eq("booking_date", date)
    // Cancelled bookings release their slot; see `job_status` in the
    // payments migration.
    .neq("job_status", "cancelled");

  if (error) throw new Error(`getBookedIntervals: ${error.message}`);

  return (data ?? []).map((row) => ({
    ref: "",
    priceKes: 0,
    durationMinutes: 0,
    date: row.booking_date as string,
    startTime: toHhMm(row.start_time as string),
    endTime: toHhMm(row.end_time as string),
    customerName: "",
    phone: "",
    vehicle: "",
    notes: "",
    paymentStatus: "unpaid" as PaymentStatus,
    createdAt: "",
  }));
}

/* ------------------------------------------------------------------ */
/* Status changes                                                      */
/* ------------------------------------------------------------------ */

export type UpdatePaymentResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "has_payment" }
  | { ok: false; reason: "db_error"; detail: string };

/**
 * Sets a booking's payment status AND records who changed it.
 *
 * The stamping is not optional, exactly as it was not optional in
 * `writeStatusChange` in src/lib/store.ts: there is no path through this
 * module that moves a status without writing a `status_changes` row, so a
 * booking whose status changed with nothing in its history cannot happen.
 *
 * `by` is passed in rather than read from a session in here, for the same
 * reason it always was — the call site should show what is being recorded.
 * It is still a SELF-REPORTED name from the "Acting as" field and proves
 * nothing about who was at the keyboard. See src/data/admin-users.ts.
 *
 * Two writes again, and unlike the booking insert this one does not
 * compensate: if the history write fails after the status write, the
 * status has moved with no record of who moved it. That is the wrong way
 * round and it is called out here rather than hidden — the same RPC that
 * fixes the insert path fixes this one.
 */
export async function updateBookingPayment(
  ref: string,
  paymentStatus: PaymentStatus,
  by: string,
): Promise<UpdatePaymentResult> {
  const db = getSupabaseServiceRoleClient();

  /*
    LEGACY BOOKINGS ONLY. A booking with a row in `payments` has its
    payment status moved by `resolve_payment()` — verify, reject, cash
    received — which issues the receipt in the same transaction. Setting
    'paid' here instead would mark it paid with no receipt and no check of
    the code, so it is refused. This path remains for bookings made before
    payments were recorded, which have nothing else.
  */
  const existing = await db
    .from("bookings")
    .select("id, payments(id)")
    .eq("business_id", BUSINESS_ID)
    .eq("ref", ref)
    .maybeSingle();
  if (existing.error) {
    return { ok: false, reason: "db_error", detail: existing.error.message };
  }
  if (!existing.data) return { ok: false, reason: "not_found" };
  if (((existing.data.payments as unknown[] | null) ?? []).length > 0) {
    return { ok: false, reason: "has_payment" };
  }

  const updated = await db
    .from("bookings")
    .update({ payment_status: paymentStatus })
    .eq("business_id", BUSINESS_ID)
    .eq("ref", ref)
    .select("id")
    .maybeSingle();

  if (updated.error) {
    return { ok: false, reason: "db_error", detail: updated.error.message };
  }
  if (!updated.data) return { ok: false, reason: "not_found" };

  const history = await db.from("status_changes").insert({
    booking_id: updated.data.id as string,
    to_status: paymentStatus,
    // From the staff session (src/lib/staff-guard.ts), never a request body.
    changed_by: by,
  });

  if (history.error) {
    return { ok: false, reason: "db_error", detail: history.error.message };
  }

  const booking = await getBookingByRef(ref);
  if (!booking) return { ok: false, reason: "not_found" };
  return { ok: true, booking };
}

/**
 * UPCOMING BOOKINGS ALREADY HELD BY ONE PHONE NUMBER — the cap against slot
 * hoarding (one bay, so every unverified booking takes a real slot).
 *
 * "Upcoming" is any booking from `fromDate` on that is still booked or in
 * progress; cancelled, done and no-show ones do not count. Cash and M-Pesa
 * alike.
 *
 * Phones are stored exactly as typed, so the comparison is done here on
 * the canonical form (`canonicalKenyanPhone`) rather than with a SQL
 * equality that would miss "+254 712…" against "0712…". The set read is
 * small — one bay, a fourteen-day window — so reading the phone column
 * for it is cheap.
 *
 * Advisory, like the slot check: two requests racing for the same number
 * at the same instant can both pass. Good enough for its job.
 */
export async function countUpcomingBookingsForPhone(
  phone: string,
  fromDate: string,
): Promise<number> {
  const wanted = canonicalKenyanPhone(phone);
  if (!wanted) return 0;

  const db = getSupabaseServiceRoleClient();
  const { data, error } = await db
    .from("bookings")
    .select("phone")
    .eq("business_id", BUSINESS_ID)
    .gte("booking_date", fromDate)
    .in("job_status", ["booked", "in_progress"]);

  if (error) throw new Error(`countUpcomingBookingsForPhone: ${error.message}`);
  return (data ?? []).filter(
    (row) => canonicalKenyanPhone(String(row.phone)) === wanted,
  ).length;
}

export const JOB_STATUSES: JobStatus[] = [
  "booked",
  "in_progress",
  "done",
  "cancelled",
  "no_show",
];

export type UpdateJobResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "db_error"; detail: string };

/**
 * Moves the WORK on a booking — booked, in progress, done, cancelled, no
 * show — and records who said so in `status_changes`, exactly as the
 * payment status writer does. Same two-writes caveat as
 * `updateBookingPayment` above.
 *
 * Deliberately separate from payment: finishing a wash says nothing about
 * whether it was paid for. Any move is allowed, including back to
 * `booked` — staff correct mistakes, and the log keeps every step.
 * Cancelling releases the slot (the slot checks skip cancelled bookings).
 */
export async function updateBookingJobStatus(
  ref: string,
  jobStatus: JobStatus,
  by: string,
): Promise<UpdateJobResult> {
  const db = getSupabaseServiceRoleClient();

  const updated = await db
    .from("bookings")
    .update({ job_status: jobStatus })
    .eq("business_id", BUSINESS_ID)
    .eq("ref", ref)
    .select("id")
    .maybeSingle();

  if (updated.error) {
    return { ok: false, reason: "db_error", detail: updated.error.message };
  }
  if (!updated.data) return { ok: false, reason: "not_found" };

  const history = await db.from("status_changes").insert({
    booking_id: updated.data.id as string,
    to_status: jobStatus,
    // From the staff session (src/lib/staff-guard.ts), never a request body.
    changed_by: by,
  });
  if (history.error) {
    return { ok: false, reason: "db_error", detail: history.error.message };
  }

  const booking = await getBookingByRef(ref);
  if (!booking) return { ok: false, reason: "not_found" };
  return { ok: true, booking };
}

/**
 * =====================================================================
 * A NOTE ON THE LEGACY SHAPE, for whoever reads this next.
 *
 * `service_id` / `service_name` are mapped above and will never be
 * written. Nothing in this app has produced a flat-tier booking since the
 * price board was transcribed, and `createBooking` has no way to make one.
 * They are carried because the columns exist and a mapper that silently
 * dropped a populated column would be a trap.
 *
 * Whether the READING side of that — `bookingLines` in src/lib/booking.ts —
 * is now dead is a separate question, answered in this stage's report
 * rather than by deleting anything here.
 * =====================================================================
 */
