/**
 * =====================================================================
 * WHAT DAY AND TIME IT IS AT THE YARD.
 * ---------------------------------------------------------------------
 * Every rule about what is bookable — today's date, the slots already
 * gone, the lead time, closing time, the closed Sunday — is a rule about
 * the clock in Maua, not the clock on whatever machine is asking. The
 * server runs on UTC, three hours behind, so reading `getHours()` there
 * measured the lead time three hours late all day, and between 00:00 and
 * 03:00 it still thought it was yesterday.
 *
 * So nothing that decides bookability reads the machine's local time.
 * An instant goes in (`now` is always a parameter, so tests can pass a
 * fixed one), Nairobi's date and minutes come out, and the browser and
 * the server run this same code and agree whatever either clock's zone is.
 *
 * Kenya has no daylight saving, but the zone is named rather than written
 * as +03:00 so the platform's tz data stays the one source of truth.
 *
 * DATE KEYS ARE CALENDAR DAYS, NOT INSTANTS. "2026-10-25" is read and
 * stepped with UTC arithmetic (`Date.UTC`, `getUTCDay`), which has no
 * zone to shift it: the weekday of a key never depends on where the code
 * runs. Never `new Date(key)` in local time.
 * =====================================================================
 */

import { BUSINESS_TIME_ZONE } from "./format-time";

export interface NairobiNow {
  /** "YYYY-MM-DD" */
  dateKey: string;
  /** Minutes since midnight, 0–1439. */
  minutes: number;
  /** 0 = Sunday ... 6 = Saturday. */
  weekday: number;
}

const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Nairobi's date, time of day and weekday at the instant `now`. */
export function nairobiNow(now: Date): NairobiNow {
  const all = parts.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    all.find((part) => part.type === type)?.value ?? "";
  const dateKey = `${get("year")}-${get("month")}-${get("day")}`;
  return {
    dateKey,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    weekday: weekdayOfDateKey(dateKey),
  };
}

/** 0 = Sunday ... 6 = Saturday, from the key alone. */
export function weekdayOfDateKey(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The key `days` calendar days after `dateKey` (negative goes back). */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
