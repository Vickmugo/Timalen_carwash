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

/**
 * EVERYTHING IS COLLECTED FROM THE PREMISES. NOTHING IS DELIVERED.
 *
 * Concrete is collected from the yard; carpets and sofa sets are brought
 * to the yard and collected from it. There is no delivery service, so no
 * form asks for an address and no page offers one.
 *
 * This is the one wording used wherever a concrete record says where the
 * goods go — the checkout, the confirmation, the receipt, the quote form
 * and the staff view — and what new orders and quote requests store in
 * their NOT NULL `delivery_location` column. No street address is given
 * because none has been confirmed; see `businessAddress` in
 * src/data/business.ts.
 */
export const COLLECT_FROM_YARD = "Collect from the yard";

/**
 * WHERE M-PESA MONEY GOES — THE ONLY PLACE THESE NUMBERS LIVE.
 *
 * Every screen that tells a customer how to pay, and the receipt letterhead,
 * reads from here. `business.tillNumber` in src/data/business.ts points at
 * the till below rather than holding a second copy.
 *
 * Which one a payment may use is decided by its stream, not by the
 * customer, and enforced by the server and by a CHECK on `payments`:
 *
 *   till      car wash bookings AND carpet/sofa requests
 *   paybill   concrete product orders
 *
 * TILL 9806711 — BUY GOODS AND SERVICES, supplied by the client. No account
 * number: a Buy Goods till does not take one.
 *
 * PAYBILL 522533, ACCOUNT 7546741 — as written on the client's sign for the
 * concrete side. 522533 is KCB's shared paybill, and the account number is
 * what routes the money to the yard. TODO / CONFIRM WITH CLIENT that this
 * is exactly what customers should type: a wrong digit in the account
 * number sends the money to somebody else's KCB account.
 *
 * NO BUSINESS NAME is shown beside either number. The name M-Pesa displays
 * before the customer confirms is the registered owner's, which nobody has
 * confirmed yet (the till sticker carries a handwritten name). Printing a
 * guess would teach customers to expect a name they may not see.
 */
export const mpesaDestinations = {
  till: {
    tillNumber: "9806711",
  },
  paybill: {
    businessNumber: "522533",
    accountNumber: "7546741",
  },
} as const;
