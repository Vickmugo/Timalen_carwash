/**
 * =====================================================================
 * WALK-INS, IN THE DATABASE — the store behind src/lib/walkin.ts.
 * ---------------------------------------------------------------------
 * SERVER ONLY, like src/lib/bookings-db.ts, whose select and mapper this
 * reuses so a walk-in comes back as the same `Booking` every screen
 * already renders.
 *
 * NOT ATOMIC, the same way `createBooking` is not: the booking, then its
 * lines, then the `walk_in_registered` status change. If either of the
 * later two fails, the booking is deleted (lines and history cascade), so
 * a walk-in never exists without its lines or without who entered it.
 *
 * PAYMENTS ARE CREATED HERE AND MOVED NOWHERE HERE. `attachWalkinPayment`
 * inserts one ordinary `claimed` or `cash_due` row through `insertPayment`,
 * at the amount the server priced the walk-in at. Verifying, rejecting and
 * taking cash stay with /api/payments/[id] and `resolve_payment()`.
 * =====================================================================
 */

import "server-only";
import { BUSINESS_ID, getSupabaseServiceRoleClient } from "@/lib/supabase";
import { makeRef } from "@/lib/format";
import { BOOKING_SELECT, asRow, getBookingByRef, toBooking } from "@/lib/bookings-db";
import { insertPayment, isCodeInUse } from "@/lib/payments-db";
import type { PaymentChoice } from "@/lib/payments";
import type { WalkinInsertResult, WalkinRecord, WalkinStore } from "@/lib/walkin";
import type { Booking } from "@/types";

/** Postgres SQLSTATE for a unique-constraint violation. */
const UNIQUE_VIOLATION = "23505";
/** The partial unique index from 20261026100000_staff_walkins.sql. */
const REQUEST_INDEX = "bookings_walkin_request_unique";
const REF_ATTEMPTS = 5;

async function findByRequestId(walkinRequestId: string): Promise<Booking | null> {
  const db = getSupabaseServiceRoleClient();
  const { data, error } = await db
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("business_id", BUSINESS_ID)
    .eq("walkin_request_id", walkinRequestId)
    .maybeSingle();
  if (error) throw new Error(`findWalkinByRequestId: ${error.message}`);
  return data ? toBooking(asRow(data)) : null;
}

async function insert(record: WalkinRecord, by: string): Promise<WalkinInsertResult> {
  const db = getSupabaseServiceRoleClient();

  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt += 1) {
    const ref = makeRef("WB");
    const inserted = await db
      .from("bookings")
      .insert({
        business_id: BUSINESS_ID,
        ref,
        source: "staff",
        walkin_request_id: record.walkinRequestId,
        vehicle_type_id: record.vehicleTypeId,
        vehicle_type_name: record.vehicleTypeName,
        price_kes: record.priceKes,
        duration_minutes: record.durationMinutes,
        booking_date: record.date,
        start_time: record.startTime,
        end_time: record.endTime,
        customer_name: record.customerName,
        phone: record.phone,
        vehicle: record.vehicle,
        notes: "",
        // Nothing is owed or arranged yet; the payment row, when staff
        // record one, is what moves this (via resolve_payment()).
        payment_status: "unpaid",
        job_status: record.jobStatus,
      })
      .select("id")
      .single();

    if (inserted.error) {
      if (inserted.error.code === UNIQUE_VIOLATION) {
        // The same form submitted twice at once: the other request won.
        if (inserted.error.message.includes(REQUEST_INDEX)) {
          return { ok: false, reason: "duplicate_request" };
        }
        continue; // a ref collision; take another
      }
      return { ok: false, reason: "db_error", detail: inserted.error.message };
    }

    const bookingId = inserted.data.id as string;

    const lines = await db.from("booking_lines").insert(
      record.lines.map((line, index) => ({
        booking_id: bookingId,
        service_id: line.serviceId,
        name: line.name,
        price_kes: line.priceKes,
        position: index,
      })),
    );
    if (lines.error) {
      await db.from("bookings").delete().eq("id", bookingId);
      return { ok: false, reason: "db_error", detail: lines.error.message };
    }

    const history = await db.from("status_changes").insert({
      booking_id: bookingId,
      to_status: "walk_in_registered",
      // From the staff session (src/lib/staff-guard.ts), never a request body.
      changed_by: by,
    });
    if (history.error) {
      await db.from("bookings").delete().eq("id", bookingId);
      return { ok: false, reason: "db_error", detail: history.error.message };
    }

    const booking = await getBookingByRef(ref);
    if (!booking) return { ok: false, reason: "db_error", detail: "walk-in vanished after insert" };
    return { ok: true, booking };
  }

  return { ok: false, reason: "db_error", detail: "ref generation exhausted" };
}

export const walkinStore: WalkinStore = { findByRequestId, insert };

/* ------------------------------------------------------------------ */
/* Recording how a walk-in pays                                        */
/* ------------------------------------------------------------------ */

export type AttachPaymentResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "not_walk_in" }
  | { ok: false; reason: "has_payment" }
  | { ok: false; reason: "code_used" }
  | { ok: false; reason: "db_error"; detail: string };

/**
 * One payment for a walk-in: cash due, or an M-Pesa code typed by staff
 * on the customer's behalf (a claim, never verified here).
 *
 * Refused if the booking already has a payment that is not rejected — a
 * rejected code can be replaced, anything else is already in a queue or
 * paid. Check-then-insert, so two taps at the same instant could both
 * pass; the form disables its buttons while sending, and a duplicate
 * `cash_due` row would sit visibly in the Cash due queue.
 */
export async function attachWalkinPayment(
  ref: string,
  choice: PaymentChoice,
): Promise<AttachPaymentResult> {
  const db = getSupabaseServiceRoleClient();
  const found = await db
    .from("bookings")
    .select("id, source, price_kes, payments(status)")
    .eq("business_id", BUSINESS_ID)
    .eq("ref", ref)
    .maybeSingle();
  if (found.error) return { ok: false, reason: "db_error", detail: found.error.message };
  if (!found.data) return { ok: false, reason: "not_found" };
  if (found.data.source !== "staff") return { ok: false, reason: "not_walk_in" };

  const payments = (found.data.payments as { status: string }[] | null) ?? [];
  if (payments.some((payment) => payment.status !== "rejected")) {
    return { ok: false, reason: "has_payment" };
  }

  if (choice.mpesaCode) {
    try {
      if (await isCodeInUse(choice.mpesaCode)) return { ok: false, reason: "code_used" };
    } catch (error) {
      return { ok: false, reason: "db_error", detail: String(error) };
    }
  }

  // The amount the server priced the walk-in at, from the row — not the body.
  const paid = await insertPayment(
    { bookingId: found.data.id as string },
    "wash",
    choice,
    found.data.price_kes as number,
  );
  if (!paid.ok) {
    if (paid.reason === "code_used") return { ok: false, reason: "code_used" };
    return { ok: false, reason: "db_error", detail: paid.detail };
  }

  const booking = await getBookingByRef(ref);
  if (!booking) return { ok: false, reason: "not_found" };
  return { ok: true, booking };
}
