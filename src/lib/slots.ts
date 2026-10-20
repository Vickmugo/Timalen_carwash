/**
 * Slot generation for the single wash bay.
 *
 * Rules implemented here (all driven by config, nothing hardcoded):
 *  - Operating hours come from `operatingHours` in src/data/business.ts.
 *  - Candidate start times step by `bookingConfig.slotGridMinutes`.
 *  - A candidate is only offered if the SERVICE'S OWN `durationMinutes`
 *    fits entirely before closing time.
 *  - One bay: a candidate is unavailable if its interval overlaps any
 *    existing booking's interval. Overlap is checked properly rather than
 *    by matching start times, so a 90-minute wax booking correctly blocks
 *    the 30-minute slots underneath it.
 *  - Slots in the past, or inside the minimum lead time, are not offered.
 *  - "Today", "now" and every weekday are Nairobi's, whatever zone the
 *    machine is in — see src/lib/nairobi-time.ts.
 */

import { operatingHours } from "@/data/business";
import { bookingConfig } from "@/data/config";
import { getFlatVehicle } from "@/data/services";
import type { Booking, WeekdayIndex } from "@/types";
import { minutesToTime, timeToMinutes } from "./format";
import { addDaysToDateKey, nairobiNow, weekdayOfDateKey } from "./nairobi-time";

export interface Slot {
  /** "HH:mm" */
  startTime: string;
  /** "HH:mm" */
  endTime: string;
  available: boolean;
  /** Why it is unavailable, for the tooltip/label. */
  reason?: "booked" | "too_soon";
}

/**
 * HOW LONG A BOOKING FOR THIS VEHICLE HOLDS THE BAY.
 *
 * One function so the grid the customer is offered (/api/slots), the slot
 * the server re-checks before writing (/api/bookings) and the length the
 * picker tells them about can never disagree. Anything that is not a
 * flat vehicle with its own figure — every grid column, and an unknown id —
 * gets the standard placeholder block.
 */
export function holdMinutesFor(vehicleId: string): number {
  return (
    getFlatVehicle(vehicleId)?.durationMinutes ??
    bookingConfig.placeholderWashDurationMinutes
  );
}

export function getDayHours(dateKey: string) {
  const weekday = weekdayOfDateKey(dateKey) as WeekdayIndex;
  return operatingHours[weekday];
}

export function isClosed(dateKey: string): boolean {
  return getDayHours(dateKey).closed;
}

/** Today's date at the yard, "YYYY-MM-DD". */
export function todayKey(now: Date = new Date()): string {
  return nairobiNow(now).dateKey;
}

/**
 * Build the list of selectable dates, spanning
 * `bookingConfig.bookingWindowDays` from today. Closed days are included so
 * the UI can show them greyed out rather than silently skipping them.
 *
 * Today is left off once the yard has closed for the day: nothing on it
 * can be booked any more, and offering it first would preselect a day of
 * struck-out times. The window still ends on the same day, today plus
 * `bookingWindowDays - 1`, so this never reaches further ahead.
 */
export function getBookableDates(now: Date = new Date()): string[] {
  const today = nairobiNow(now);
  const closedForToday =
    today.minutes >= timeToMinutes(getDayHours(today.dateKey).close);
  const dates: string[] = [];
  for (
    let offset = closedForToday ? 1 : 0;
    offset < bookingConfig.bookingWindowDays;
    offset += 1
  ) {
    dates.push(addDaysToDateKey(today.dateKey, offset));
  }
  return dates;
}

function overlaps(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && startB < endA;
}

export function generateSlots(
  dateKey: string,
  durationMinutes: number,
  existingBookings: Booking[],
  now: Date = new Date(),
): Slot[] {
  const hours = getDayHours(dateKey);
  if (hours.closed) return [];

  const openMinutes = timeToMinutes(hours.open);
  const closeMinutes = timeToMinutes(hours.close);

  // Only bookings on this date can conflict.
  const sameDay = existingBookings
    .filter((booking) => booking.date === dateKey)
    .map((booking) => ({
      start: timeToMinutes(booking.startTime),
      end: timeToMinutes(booking.endTime),
    }));

  /*
    A start is offered only at or after now plus the lead time, in Nairobi
    minutes. A day already gone offers nothing; a later day is unaffected.
    Before opening the same rule applies, so at 07:00 the 08:00 slot is
    exactly one lead time away and is offered.
  */
  const today = nairobiNow(now);
  const earliestStart =
    dateKey < today.dateKey
      ? Infinity
      : dateKey === today.dateKey
        ? today.minutes + bookingConfig.minimumLeadTimeMinutes
        : -Infinity;

  const slots: Slot[] = [];
  for (
    let start = openMinutes;
    start + durationMinutes <= closeMinutes;
    start += bookingConfig.slotGridMinutes
  ) {
    const end = start + durationMinutes;

    let available = true;
    let reason: Slot["reason"];

    if (start < earliestStart) {
      available = false;
      reason = "too_soon";
    } else if (sameDay.some((b) => overlaps(start, end, b.start, b.end))) {
      available = false;
      reason = "booked";
    }

    slots.push({
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
      available,
      reason,
    });
  }

  return slots;
}

/** Said when a start time has passed or is inside the lead time. */
export const TOO_SOON_MESSAGE =
  "That time has passed or is too close to book. Please pick a later slot.";

export type SlotCheck =
  | { ok: true; slot: Slot }
  | { ok: false; error: "bad_start" | "too_soon" | "slot_taken" };

/**
 * Whether `startTime` can be booked on a grid from `generateSlots`.
 *
 * A start that has passed or is too close says `too_soon`, and it wins over
 * `slot_taken` when both are true, because `generateSlots` marks the time
 * rule first. Only a start that is genuinely taken says `slot_taken`.
 */
export function checkSlot(slots: Slot[], startTime: string): SlotCheck {
  const slot = slots.find((candidate) => candidate.startTime === startTime);
  if (!slot) return { ok: false, error: "bad_start" };
  if (slot.available) return { ok: true, slot };
  return { ok: false, error: slot.reason === "too_soon" ? "too_soon" : "slot_taken" };
}
