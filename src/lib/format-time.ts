/**
 * "20 Oct, 00:36" — an instant as it reads in the yard, in Kenyan time.
 *
 * ALWAYS AFRICA/NAIROBI, never the machine's own timezone. The server runs
 * on UTC, three hours behind, so a receipt rendered there printed
 * "19 Oct, 21:36" for a payment confirmed at 00:36 on the 20th. Pinning
 * the zone makes the server, a staff browser and a customer's phone abroad
 * all print the same string, and a client component's server render
 * matches its hydration.
 *
 * Nairobi has no daylight saving, but the zone name is used rather than a
 * fixed +03:00 so the platform's tz data stays the one source of truth.
 *
 * No imports, so the tests can load it on its own. Renders "-" for a
 * malformed value rather than "Invalid Date".
 */

export const BUSINESS_TIME_ZONE = "Africa/Nairobi";

const parts = new Intl.DateTimeFormat("en-KE", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const all = parts.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    all.find((part) => part.type === type)?.value ?? "";
  return `${get("day")} ${get("month")}, ${get("hour")}:${get("minute")}`;
}
