import { WEEKDAY_NAMES } from "@/data/business";

/** "KES 1,350" — whole shillings, no decimals. */
export function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE")}`;
}

/** "YYYY-MM-DD" for a local Date, avoiding the UTC shift of toISOString(). */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse "YYYY-MM-DD" into a local Date at midnight. */
export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** "Tuesday, 3 September" */
export function formatLongDate(dateKey: string): string {
  const date = fromDateKey(dateKey);
  return `${WEEKDAY_NAMES[date.getDay()]}, ${date.getDate()} ${date.toLocaleString(
    "en-KE",
    { month: "long" },
  )}`;
}

/** "3 Sep" */
export function formatShortDate(dateKey: string): string {
  const date = fromDateKey(dateKey);
  return `${date.getDate()} ${date.toLocaleString("en-KE", { month: "short" })}`;
}

/**
 * "3 Sep, 14:20" — an ISO timestamp as staff read it in the admin tables.
 *
 * Date and time together, because "when did this come in" is the question
 * being asked of a quote request, and the answer is often "an hour ago".
 * Renders "-" for a malformed value rather than "Invalid Date".
 */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const day = `${date.getDate()} ${date.toLocaleString("en-KE", { month: "short" })}`;
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
  return `${day}, ${time}`;
}

/** Minutes since midnight -> "HH:mm". */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** "HH:mm" -> minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

/** "45 min" / "1 hr 30 min" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourPart = `${hours} hr`;
  return rest === 0 ? hourPart : `${hourPart} ${rest} min`;
}

/**
 * 32 characters with no 0/O or 1/I, so a ref read down a phone line cannot
 * be misheard into another one.
 */
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** New refs are this long; refs issued before were 6 and stay valid. */
const REF_LENGTH = 8;

/**
 * A ref like "WB-4K9T2XQ7".
 *
 * Eight characters from a 32-letter alphabet is 40 bits, up from 30 at
 * six. The randomness is the platform CSPRNG (`crypto.getRandomValues`,
 * present in Node and in browsers — this file runs in both), not
 * Math.random, whose output can be predicted from earlier values. 256 is a
 * multiple of 32, so `byte & 31` picks every letter with equal odds.
 *
 * Collisions are still possible in principle; the database's unique index
 * on `ref` catches one and the caller retries.
 */
export function makeRef(prefix: string): string {
  const bytes = new Uint8Array(REF_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  let body = "";
  for (const byte of bytes) body += REF_ALPHABET[byte & 31];
  return `${prefix}-${body}`;
}

/** Two-letter prefix, then 6 (older) or 8 (current) alphabet characters. */
const REF_PATTERN = /^[A-Z]{2}-[A-HJ-NP-Z2-9]{6}(?:[A-HJ-NP-Z2-9]{2})?$/;

/** True for any ref this app has ever issued, old length or new. */
export function isRef(value: string, prefix?: string): boolean {
  return REF_PATTERN.test(value) && (!prefix || value.startsWith(`${prefix}-`));
}
