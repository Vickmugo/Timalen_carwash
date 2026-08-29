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
 */

import { operatingHours } from "@/data/business";
import { bookingConfig } from "@/data/config";
import type { Booking, WeekdayIndex } from "@/types";
import { fromDateKey, minutesToTime, timeToMinutes, toDateKey } from "./format";

export interface Slot {
  /** "HH:mm" */
  startTime: string;
  /** "HH:mm" */
  endTime: string;
  available: boolean;
  /** Why it is unavailable, for the tooltip/label. */
  reason?: "booked" | "too_soon";
}

export function getDayHours(dateKey: string) {
  const weekday = fromDateKey(dateKey).getDay() as WeekdayIndex;
  return operatingHours[weekday];
}

export function isClosed(dateKey: string): boolean {
  return getDayHours(dateKey).closed;
}

/**
 * Build the list of selectable dates, starting today, spanning
 * `bookingConfig.bookingWindowDays`. Closed days are included so the UI can
 * show them greyed out rather than silently skipping them.
 */
export function getBookableDates(from: Date = new Date()): string[] {
  const dates: string[] = [];
  for (let offset = 0; offset < bookingConfig.bookingWindowDays; offset += 1) {
    const date = new Date(from);
    date.setDate(date.getDate() + offset);
    dates.push(toDateKey(date));
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

  const isToday = dateKey === toDateKey(now);
  const earliestStart = isToday
    ? now.getHours() * 60 + now.getMinutes() + bookingConfig.minimumLeadTimeMinutes
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
