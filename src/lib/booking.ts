/**
 * =====================================================================
 * BOOKINGS — READING THEM, AND PRICING A NEW ONE
 * ---------------------------------------------------------------------
 * Two jobs that both exist because a booking is no longer one service at
 * one price:
 *
 *   READING. A stored booking comes in one of two shapes. New ones carry
 *   `vehicleTypeId` and a `lines` array off the price board. Old ones —
 *   already sitting in visitors' localStorage from before the board was
 *   transcribed — carry a single invented `serviceName` and nothing else.
 *   Every reader (the confirmation page, the receipt, the staff view) goes
 *   through `bookingLines` and `bookingVehicleTypeName` here, so there is
 *   ONE place that knows the old shape exists. Without that, three
 *   components each grow their own `booking.serviceName ?? ...` fallback
 *   and one of them eventually gets it wrong.
 *
 *   PRICING. `selectionTotalKes` and `subsumption` are what the picker in
 *   /book runs on. They live here rather than in the component so the rule
 *   that an unread cell can never be charged is testable on its own.
 * =====================================================================
 */

import { priceFor } from "@/data/services";
import type {
  Booking,
  BookingLine,
  VehicleTypeId,
  WashPriceRow,
} from "@/types";

/* ------------------------------------------------------------------ */
/* Reading a stored booking                                            */
/* ------------------------------------------------------------------ */

/**
 * What was booked, itemised — whichever shape the record is in.
 *
 * A legacy booking becomes a single synthetic line carrying the whole
 * price, which is exactly what it was: one tier, one figure. It is not
 * marked as legacy in the returned data, because nothing displaying a
 * booking should render differently for an old one — the customer holding
 * that reference booked a real slot and their receipt has to keep working.
 *
 * Returns an empty array only for a record with neither shape, which means
 * corrupt storage. Callers render "not recorded" rather than crashing.
 */
export function bookingLines(booking: Booking): BookingLine[] {
  if (booking.lines && booking.lines.length > 0) return booking.lines;

  if (booking.serviceName) {
    return [
      {
        serviceId: booking.serviceId ?? "legacy",
        name: booking.serviceName,
        priceKes: booking.priceKes,
      },
    ];
  }

  return [];
}

/**
 * "Body Wash, Under Wash" — the one-line answer to "what are they having
 * done", for a table cell or a search index.
 */
export function bookingServiceText(booking: Booking): string {
  const lines = bookingLines(booking);
  return lines.length > 0 ? lines.map((line) => line.name).join(", ") : "-";
}

/**
 * The board column this booking was priced against, or null for a record
 * made before the flow asked.
 *
 * Null rather than a guessed "Saloon": the old flow never asked which
 * vehicle type it was, so nobody knows, and printing a column name on a
 * receipt that was never priced against it would be inventing the one
 * detail that decides the price.
 */
export function bookingVehicleTypeName(booking: Booking): string | null {
  return booking.vehicleTypeName ?? null;
}

/* ------------------------------------------------------------------ */
/* Pricing a new booking                                               */
/* ------------------------------------------------------------------ */

/**
 * The running total for a set of chosen services at one vehicle type.
 *
 * Unread cells contribute NOTHING and are not silently treated as zero —
 * they cannot be in `selectedIds` in the first place, because the picker
 * cannot select a row it renders as unavailable, and `toLines` below drops
 * any that slip through. The two together mean a null can never become a
 * line worth 0 on somebody's receipt.
 */
export function selectionTotalKes(
  rows: WashPriceRow[],
  selectedIds: ReadonlySet<string>,
  vehicleTypeId: VehicleTypeId,
): number {
  return toLines(rows, selectedIds, vehicleTypeId).reduce(
    (total, line) => total + line.priceKes,
    0,
  );
}

/**
 * The chosen services as booking lines, in board order.
 *
 * Board order, not click order: a receipt that lists the work in the same
 * sequence as the board on the wall is one a customer can check against it.
 * Click order would put them in whatever sequence somebody happened to tap.
 */
export function toLines(
  rows: WashPriceRow[],
  selectedIds: ReadonlySet<string>,
  vehicleTypeId: VehicleTypeId,
): BookingLine[] {
  const lines: BookingLine[] = [];
  for (const row of rows) {
    if (!selectedIds.has(row.id)) continue;
    const price = priceFor(row, vehicleTypeId);
    // The guard that makes "an unread cell is never charged" structural.
    if (price === null) continue;
    lines.push({ serviceId: row.id, name: row.name, priceKes: price });
  }
  return lines;
}

/** What one selection implies about the other rows in the list. */
export interface Subsumption {
  /**
   * Rows already covered by something else that is selected. The picker
   * disables these and labels them with the covering service, so nobody
   * pays for the same work twice.
   */
  covered: Map<string, string>;
  /**
   * Selected rows whose scope is UNCONFIRMED (`subsumes: null`) — today
   * that is Complete Wash. The picker warns that other lines may already be
   * included rather than deselecting anything, because nobody has
   * established what is included.
   */
  unconfirmedScope: WashPriceRow[];
}

/**
 * THE "COMPLETE WASH PROBABLY ALREADY INCLUDES THAT" RULE.
 *
 * Two behaviours, and which one applies is decided by the data rather than
 * by this function guessing:
 *
 *   subsumes: ["body-wash", ...]   CONFIRMED. Those rows are returned in
 *                                  `covered`, and the picker takes them out
 *                                  of the total — the customer is not
 *                                  charged twice.
 *
 *   subsumes: null                 UNCONFIRMED. Nothing is removed. The row
 *                                  is returned in `unconfirmedScope` and the
 *                                  picker shows a warning, because quietly
 *                                  dropping a paid line on a hunch is worse
 *                                  than asking.
 *
 * Today every path leads to the second: Complete Wash is the only row with
 * a `subsumes` marker, it is `null`, and the row has no price so it cannot
 * be selected at all. This is wired ahead of that on purpose — the day the
 * board is re-read, a price and an inclusion list are the only changes
 * needed, both in src/data/services.ts.
 */
export function subsumption(
  rows: WashPriceRow[],
  selectedIds: ReadonlySet<string>,
): Subsumption {
  const covered = new Map<string, string>();
  const unconfirmedScope: WashPriceRow[] = [];

  for (const row of rows) {
    if (!selectedIds.has(row.id)) continue;

    if (row.subsumes === null) {
      unconfirmedScope.push(row);
      continue;
    }
    if (!row.subsumes) continue;

    for (const id of row.subsumes) {
      // A row never covers itself, however the data is written.
      if (id !== row.id) covered.set(id, row.name);
    }
  }

  return { covered, unconfirmedScope };
}

/**
 * The selection with covered rows removed.
 *
 * Applied before pricing and before the booking is written, so a covered
 * service cannot reach the total, the receipt or the staff view even if it
 * was ticked before the covering service was.
 */
export function withoutCovered(
  selectedIds: ReadonlySet<string>,
  covered: ReadonlyMap<string, string>,
): Set<string> {
  const next = new Set(selectedIds);
  for (const id of covered.keys()) next.delete(id);
  return next;
}
