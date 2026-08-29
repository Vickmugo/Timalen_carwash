/**
 * TUNABLE RULES
 *
 * Booking mechanics and the cart -> quote threshold. These are config
 * values on purpose: the threshold logic reads from here in one place
 * (`src/lib/quote.ts`) rather than being scattered across components.
 */

export const bookingConfig = {
  /**
   * Spacing of candidate start times, in minutes.
   *
   * This is the GRID, not the service length. Each service declares its own
   * `durationMinutes` (see src/data/services.ts) and a candidate slot is only
   * offered if the full duration fits before closing and does not overlap an
   * existing booking. A 60-minute service on a 30-minute grid can therefore
   * still start at 08:30.
   */
  slotGridMinutes: 30,

  /** How many days ahead a customer may book, starting today. */
  bookingWindowDays: 14,

  /**
   * Minimum notice before a slot can be booked, in minutes.
   * TODO / CONFIRM WITH CLIENT: is same-hour booking acceptable?
   */
  minimumLeadTimeMinutes: 60,

  /**
   * Single wash bay: one booking per overlapping interval.
   * This demo deliberately does NOT model multiple bays or resources.
   */
  bays: 1,
} as const;

/**
 * QUOTE THRESHOLD
 *
 * An order that trips ANY of these rules cannot be checked out online and
 * is routed to the quote form instead — no payment is taken. Evaluated in
 * `src/lib/quote.ts`.
 *
 * TODO / CONFIRM WITH CLIENT: both numbers are guesses. Ask what order size
 * actually needs a site visit, a delivery quote, or a production lead time.
 */
export const quoteRules = {
  /** More than this many units of any single item forces a quote. */
  maxUnitsPerLine: 50,

  /** A cart subtotal above this (KES) forces a quote. */
  maxOrderTotalKes: 150_000,

  /**
   * Any product flagged `quoteOnly: true` in src/data/products.ts forces a
   * quote regardless of quantity — used for bespoke / decorative work.
   */
} as const;

export const paymentConfig = {
  currency: "KES",
  /**
   * Which aggregator the client intends to use once this goes live.
   * Shown in the checkout UI as the payment method label.
   *
   * TODO / CONFIRM WITH CLIENT: pick one of Pesapal / Flutterwave / IntaSend.
   * All three wrap M-Pesa STK push, so the client does not need a direct
   * Daraja integration.
   */
  aggregatorLabel: "M-Pesa (via payment provider)",
} as const;
