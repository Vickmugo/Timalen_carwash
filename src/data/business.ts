/**
 * BUSINESS IDENTITY + OPERATING HOURS
 *
 * Everything a non-developer needs to change about "who we are and when
 * we're open" lives in this file. No component hardcodes any of it.
 *
 * TODO / CONFIRM WITH CLIENT — every value in this file is a placeholder.
 */

import type { DayHours, WeekdayIndex } from "@/types";

export const business = {
  /** TODO: replace with the real trading name. Kept as a literal placeholder on purpose. */
  name: "[Business Name]",

  /** TODO: confirm. Appears under the logo in the header and in the footer. */
  tagline: "Car wash and concrete works, one yard",

  /** TODO: confirm the real physical address / landmark. */
  location: "[Street / Estate], [Town], Kenya",

  /** TODO: replace with the real number. Format: 07XX XXX XXX */
  phone: "07XX XXX XXX",

  /** TODO: replace. Used for the WhatsApp link (international format, no +). */
  whatsapp: "2547XXXXXXXX",

  /** TODO: replace or remove if the client has no email. */
  email: "hello@example.co.ke",
} as const;

/**
 * OPERATING HOURS — single source of truth for slot generation.
 *
 * TODO / CONFIRM WITH CLIENT: placeholder is Mon-Sat 08:00-18:00, closed
 * Sunday. Ask specifically about (a) public holidays and (b) whether the
 * wash bay closes earlier than the concrete yard.
 *
 * `close` is the time the LAST SLOT MUST END BY, not the last start time.
 */
export const operatingHours: Record<WeekdayIndex, DayHours> = {
  0: { open: "08:00", close: "18:00", closed: true }, // Sunday - closed
  1: { open: "08:00", close: "18:00", closed: false },
  2: { open: "08:00", close: "18:00", closed: false },
  3: { open: "08:00", close: "18:00", closed: false },
  4: { open: "08:00", close: "18:00", closed: false },
  5: { open: "08:00", close: "18:00", closed: false },
  6: { open: "08:00", close: "18:00", closed: false }, // Saturday
};

/** Human-readable summary rendered in the header/footer. */
export const hoursSummary = "Mon - Sat, 08:00 - 18:00 | Closed Sunday";

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
