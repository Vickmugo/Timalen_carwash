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
   * This is the GRID, not the length of the work. A candidate slot is only
   * offered if the booking's whole duration fits before closing and does
   * not overlap an existing booking, so a 60-minute booking on a 30-minute
   * grid can still start at 08:30.
   */
  slotGridMinutes: 30,

  /**
   * HOW LONG ONE BOOKING HOLDS THE BAY. STILL A PLACEHOLDER.
   *
   * The price board (src/data/services.ts) prices work. It says nothing
   * whatsoever about how long any of it takes, and nobody has been asked.
   * So every booking reserves this one block of bay time no matter how much
   * is on it — a body wash alone and a body wash plus polishing plus seat
   * wash currently occupy the bay for exactly as long, which is obviously
   * not true of the real yard.
   *
   * That is the SAME placeholder behaviour as before the board was wired
   * in, deliberately left alone: the old per-tier figures (45 and 90
   * minutes) were guesses too, and replacing one guess with a per-service
   * guess would look like progress while being the same invention spread
   * over eleven rows. 30 minutes is the one figure that was ever confirmed
   * with the client, for a basic wash.
   *
   * TODO / CONFIRM WITH CLIENT: how long each board service takes, and
   * whether services booked together overlap (two people on one car) or
   * queue. Until then this is knowingly wrong for multi-service bookings
   * and the booking flow says so on screen.
   */
  placeholderWashDurationMinutes: 30,

  /**
   * HOW LONG A LORRY OR BUS BOOKING HOLDS THE BAY. ALSO A PLACEHOLDER.
   *
   * Nobody has said how long either takes. 90 minutes was chosen by the
   * owner of this build in September 2026 as a stand-in, on the reasoning
   * that a lorry is plainly not a 30-minute saloon — not read off anything
   * the yard said. It is three grid steps, so a lorry booking blocks the
   * three standard slots underneath it; `generateSlots` checks real
   * intervals, so that blocking is exact rather than approximate.
   *
   * TODO / CONFIRM WITH CLIENT: the real figure, and whether a Canter and
   * an F.S.R. take the same time. Every lorry and bus size uses this one
   * number until then.
   */
  placeholderLargeVehicleDurationMinutes: 90,

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
