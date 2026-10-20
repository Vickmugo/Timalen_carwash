/**
 * What is bookable, at fixed instants, read as Nairobi time.
 *
 *     npm test
 *
 * Run it under more than one TZ: the answers must not change.
 *
 *     TZ=UTC npm test
 *     TZ=Africa/Nairobi npm test
 *     TZ=America/New_York npm test
 *
 * The routes compose exactly these calls with one `now`: the date must be
 * in `getBookableDates(now)`, the start time must be an available slot in
 * `generateSlots(..., now)`, and the per-phone cap counts from
 * `todayKey(now)`. Lead time is 60 minutes, hours 08:00–18:00, closed
 * Sunday (src/data/config.ts, src/data/business.ts).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { addDaysToDateKey, nairobiNow, weekdayOfDateKey } from "../src/lib/nairobi-time";
import { checkSlot, generateSlots, getBookableDates, todayKey } from "../src/lib/slots";
import type { Booking } from "../src/types";

const NONE: Booking[] = [];

function offered(dateKey: string, now: Date): string[] {
  return generateSlots(dateKey, 30, NONE, now)
    .filter((slot) => slot.available)
    .map((slot) => slot.startTime);
}

/** What /api/bookings checks, minus the database. */
function wouldAccept(dateKey: string, startTime: string, now: Date): boolean {
  if (!getBookableDates(now).includes(dateKey)) return false;
  const slot = generateSlots(dateKey, 30, NONE, now).find((s) => s.startTime === startTime);
  return slot?.available === true;
}

test("15:11 Tuesday: the first slot is at or after now plus the lead time", () => {
  const now = new Date("2026-10-20T12:11:00Z");
  assert.deepEqual(nairobiNow(now), { dateKey: "2026-10-20", minutes: 15 * 60 + 11, weekday: 2 });
  const slots = offered("2026-10-20", now);
  assert.equal(slots[0], "16:30");
  for (const gone of ["13:30", "14:00", "14:30", "15:00", "15:30", "16:00"]) {
    assert.ok(!slots.includes(gone), `${gone} should not be offered`);
  }
  assert.equal(wouldAccept("2026-10-20", "14:00", now), false);
  assert.equal(wouldAccept("2026-10-20", "16:30", now), true);
});

test("00:30 Tuesday: today is 20 Oct and 08:00 that day is bookable", () => {
  const now = new Date("2026-10-19T21:30:00Z");
  assert.equal(todayKey(now), "2026-10-20");
  const dates = getBookableDates(now);
  assert.equal(dates[0], "2026-10-20");
  assert.equal(dates.length, 14);
  assert.equal(dates.at(-1), "2026-11-02");
  assert.equal(wouldAccept("2026-10-20", "08:00", now), true);
  // The day before is outside the window.
  assert.equal(wouldAccept("2026-10-19", "17:30", now), false);
});

test("01:00 Sunday 25 Oct: closed, no slots", () => {
  const now = new Date("2026-10-24T22:00:00Z");
  assert.equal(todayKey(now), "2026-10-25");
  assert.equal(weekdayOfDateKey("2026-10-25"), 0);
  assert.equal(getBookableDates(now)[0], "2026-10-25");
  assert.deepEqual(generateSlots("2026-10-25", 30, NONE, now), []);
});

test("00:30 Monday 26 Oct: open, today is 26 Oct", () => {
  const now = new Date("2026-10-25T21:30:00Z");
  assert.equal(todayKey(now), "2026-10-26");
  assert.equal(getBookableDates(now)[0], "2026-10-26");
  assert.equal(offered("2026-10-26", now)[0], "08:00");
});

test("18:30 Tuesday: after closing, no slots today and the list starts tomorrow", () => {
  const now = new Date("2026-10-20T15:30:00Z");
  assert.deepEqual(offered("2026-10-20", now), []);
  const dates = getBookableDates(now);
  assert.equal(dates[0], "2026-10-21");
  // The window still ends where it would have: today + 13.
  assert.equal(dates.at(-1), "2026-11-02");
  assert.equal(wouldAccept("2026-10-20", "17:30", now), false);
  assert.equal(offered("2026-10-21", now)[0], "08:00");
});

test("07:00 Tuesday: before opening, the lead time still applies, so 08:00 is offered", () => {
  const now = new Date("2026-10-20T04:00:00Z");
  assert.equal(getBookableDates(now)[0], "2026-10-20");
  assert.equal(offered("2026-10-20", now)[0], "08:00");
  // At 07:01 the 08:00 slot is inside the hour and goes.
  assert.equal(offered("2026-10-20", new Date("2026-10-20T04:01:00Z"))[0], "08:30");
});

test("00:30 Nairobi: today's 08:00 booking falls inside the per-phone cap window", () => {
  const now = new Date("2026-10-19T21:30:00Z");
  // countUpcomingBookingsForPhone counts booking_date >= this key.
  const from = todayKey(now);
  assert.equal(from, "2026-10-20");
  assert.ok("2026-10-20" >= from);
  // After closing the cap still counts from today, not from the first
  // bookable date (which has moved to tomorrow).
  const evening = new Date("2026-10-20T15:30:00Z");
  assert.equal(todayKey(evening), "2026-10-20");
  assert.equal(getBookableDates(evening)[0], "2026-10-21");
});

test("date keys step across month ends without a zone", () => {
  assert.equal(addDaysToDateKey("2026-10-31", 1), "2026-11-01");
  assert.equal(addDaysToDateKey("2026-12-31", 1), "2027-01-01");
  assert.equal(weekdayOfDateKey("2026-11-01"), 0);
});

/* ---- what /api/bookings answers for one start time (checkSlot) ---- */

function booked(date: string, startTime: string, endTime: string): Booking {
  return { date, startTime, endTime } as Booking;
}

test("a passed slot is too_soon, a taken slot is slot_taken, a free one is accepted", () => {
  const now = new Date("2026-10-20T12:11:00Z"); // 15:11 Tuesday
  const today = generateSlots("2026-10-20", 30, [booked("2026-10-20", "17:00", "17:30")], now);
  assert.deepEqual(checkSlot(today, "14:00"), { ok: false, error: "too_soon" });
  assert.deepEqual(checkSlot(today, "17:00"), { ok: false, error: "slot_taken" });
  const free = checkSlot(today, "17:30");
  assert.equal(free.ok, true);
  assert.deepEqual(checkSlot(today, "03:00"), { ok: false, error: "bad_start" });
});

test("passed and taken at once: too_soon wins", () => {
  const now = new Date("2026-10-20T12:11:00Z");
  const today = generateSlots("2026-10-20", 30, [booked("2026-10-20", "14:00", "14:30")], now);
  assert.deepEqual(checkSlot(today, "14:00"), { ok: false, error: "too_soon" });
});

test("tomorrow, a free slot is accepted and a taken one is slot_taken", () => {
  const now = new Date("2026-10-20T12:11:00Z");
  const tomorrow = generateSlots("2026-10-21", 30, [booked("2026-10-21", "09:00", "09:30")], now);
  assert.equal(checkSlot(tomorrow, "08:00").ok, true);
  assert.deepEqual(checkSlot(tomorrow, "09:00"), { ok: false, error: "slot_taken" });
});
