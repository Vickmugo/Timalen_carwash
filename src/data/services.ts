/**
 * =====================================================================
 * THE WASH PRICE BOARD
 * ---------------------------------------------------------------------
 * The painted board in the wash bay, transcribed from a photo. It is the
 * only source of wash pricing in this project, and /book, /prices and the
 * home page all read from it.
 *
 * The three flat tiers that used to live here — "Exterior Wash", "Full
 * Wash + Vacuum", "Wash + Wax" — are GONE. They were invented before
 * anyone had seen the board, at guessed prices, under names the yard does
 * not sell. /book now asks for the vehicle type and then prices the real
 * services against it.
 *
 * ---------------------------------------------------------------------
 * THE ONE RULE FOR EVERY PRICE IN THIS FILE
 *
 *   A NUMBER CAME OFF THE BOARD. `null` MEANS NOBODY HAS READ THAT CELL
 *   YET.
 *
 * No cell is ever filled with a plausible-looking guess. A guessed 800
 * sitting next to a real 800 is indistinguishable a week later, and the
 * whole point of transcribing the board was to stop the site quoting
 * invented figures. So an unread cell is `null`, is annotated with WHY it
 * is unread, and everything that displays these handles it: /prices prints
 * "Ask at the yard" and /book shows the service greyed out with the same
 * words rather than hiding it. See `PriceCell` in src/types/index.ts.
 *
 * Every cell below carries its own marker:
 *     // board      read off the photo with confidence
 *     // NOT READ   no confident value; the comment says why
 *
 * Per cell, deliberately, and not as one note at the top: this
 * transcription is PARTIAL, and a blanket "transcribed from the price
 * board" header would quietly promote the unread cells to the same
 * standing as the read ones the first time somebody skims the file.
 *
 * ---------------------------------------------------------------------
 * TODO / CONFIRM WITH CLIENT — the outstanding list, all pricing:
 *   - Interior Wash, Complete Wash and Buffing: all three vehicle columns.
 *     That band of the board was too skewed and too compressed in the
 *     photo to read. All three are unbookable until it is read.
 *   - Carpets: Sofa Set. No legible value; it looks cropped out of frame.
 *   - Buses: Bus (the full-size one). Same, no legible value.
 *   - Carpets Medium and Large may be one figure spanning two rows rather
 *     than two equal figures. Recorded as read; see the note there.
 *   - Three of the eight confirmed grid rows price a SMALLER vehicle above
 *     a larger one. Recorded exactly as read and listed at
 *     `nonMonotonicRows` below — worth one more look at the board, since
 *     an inverted pair is the shape a misread digit takes.
 *   - What a Complete Wash actually includes. See `subsumes` on that row.
 *
 * DURATIONS ARE NOT IN THIS FILE AT ALL. The board prices work; it says
 * nothing about how long any of it takes. Every booking is given one
 * placeholder block of bay time from `bookingConfig` in src/data/config.ts,
 * which is the same placeholder behaviour as before and is still
 * outstanding.
 *
 * FLAT-PRICED ITEMS (carpets, lorries, buses, motorbikes) are listed on
 * /prices but are NOT bookable online. They are not priced by the three
 * vehicle columns the booking flow is built around, and half of them are
 * not cars. Phone the yard.
 * =====================================================================
 */

import type {
  FlatPriceGroup,
  PriceCell,
  VehicleType,
  VehicleTypeId,
  WashPriceRow,
} from "@/types";

/* ------------------------------------------------------------------ */
/* The price board — per vehicle type                                  */
/* ------------------------------------------------------------------ */

/** The board's three columns, left to right, named as painted. */
export const vehicleTypes: VehicleType[] = [
  { id: "saloon", name: "Saloon" },
  { id: "family-car", name: "Family Car" },
  { id: "pickup", name: "Pick-up" },
];

/**
 * The grid, in board order.
 *
 * Eight rows read with confidence; three rows — Interior Wash, Complete
 * Wash, Buffing — sit in a band of the photo that was too skewed and too
 * compressed to read, so all nine of their cells are `null`. They are kept
 * in place rather than dropped, because their POSITION on the board is
 * known even where their prices are not, and deleting them would lose that
 * along with the fact that they are missing at all.
 */
export const washPriceRows: WashPriceRow[] = [
  {
    id: "body-wash",
    name: "Body Wash",
    prices: {
      saloon: 200, // board
      "family-car": 300, // board
      pickup: 300, // board
    },
  },
  {
    id: "engine-wash",
    name: "Engine Wash",
    prices: {
      saloon: 200, // board
      // board - reads 900, which is well above the Pick-up cell beside it.
      // Recorded as read; see `nonMonotonicRows`.
      "family-car": 900,
      pickup: 300, // board
    },
  },
  {
    id: "under-wash",
    name: "Under Wash",
    prices: {
      saloon: 250, // board
      "family-car": 600, // board
      pickup: 600, // board
    },
  },
  {
    id: "dry-vacuum",
    name: "Dry Vacuum",
    prices: {
      // board - reads 500, above both larger vehicles. Recorded as read;
      // see `nonMonotonicRows`.
      saloon: 500,
      "family-car": 200, // board
      pickup: 300, // board
    },
  },
  {
    id: "wet-vacuum",
    name: "Wet Vacuum",
    prices: {
      saloon: 150, // board
      "family-car": 300, // board
      pickup: 1200, // board
    },
  },
  {
    id: "polishing",
    name: "Polishing",
    prices: {
      saloon: 200, // board
      "family-car": 1200, // board
      pickup: 2000, // board
    },
  },
  {
    id: "roof-wash",
    name: "Roof Wash",
    prices: {
      saloon: 1000, // board
      "family-car": 2000, // board
      pickup: 2500, // board
    },
  },
  {
    id: "seat-wash",
    name: "Seat Wash",
    prices: {
      saloon: 1500, // board
      // board - reads 2500, above the Pick-up cell beside it. Recorded as
      // read; see `nonMonotonicRows`.
      "family-car": 2500,
      pickup: 2000, // board
    },
  },
  {
    id: "interior-wash",
    name: "Interior Wash",
    prices: {
      // NOT READ - this band of the board was too skewed and compressed in
      // the photo to read any of the three columns. Needs a clearer photo
      // or in-person confirmation. No guess is recorded in its place.
      saloon: null,
      "family-car": null, // NOT READ - same band, same reason
      pickup: null, // NOT READ - same band, same reason
    },
  },
  {
    id: "complete-wash",
    name: "Complete Wash",
    /*
      UNCONFIRMED SCOPE — deliberately `null`, not a list.

      A "Complete Wash" almost certainly already covers several of the rows
      above it, and charging for both would overcharge. But nobody has
      confirmed WHICH rows, and an invented inclusion list silently removes
      money from a booking — a costlier guess than an invented price, not a
      cheaper one. So the picker warns about the possible overlap and lets
      the customer decide, instead of deselecting lines on a hunch.

      Fill this in with the real list once the yard confirms it and the
      picker starts deselecting automatically, with no other change. See
      `subsumes` in src/types/index.ts and `subsumption` in
      src/lib/booking.ts.

      Inert today either way: this row has no price, so it cannot be
      selected at all.
    */
    subsumes: null,
    prices: {
      saloon: null, // NOT READ - same illegible band as Interior Wash
      "family-car": null, // NOT READ - same illegible band
      pickup: null, // NOT READ - same illegible band
    },
  },
  {
    id: "buffing",
    name: "Buffing",
    prices: {
      saloon: null, // NOT READ - same illegible band as Interior Wash
      "family-car": null, // NOT READ - same illegible band
      pickup: null, // NOT READ - same illegible band
    },
  },
];

/**
 * The confirmed rows where a smaller vehicle is priced ABOVE a larger one.
 *
 * Recorded, not corrected. These cells were read with confidence and are
 * stored exactly as read — a yard is free to price however it likes, and
 * quietly "fixing" a real number to match an assumption about how prices
 * ought to run is precisely the invention this file exists to prevent.
 *
 * But an inverted pair is also the shape a misread digit takes, and these
 * four are the cells most worth a second glance when someone next stands in
 * front of the board. Listed by id so a check can be run against the data
 * rather than against somebody's memory of this comment.
 */
export const nonMonotonicRows: string[] = [
  "engine-wash", // Family Car 900 > Pick-up 300
  "dry-vacuum", // Saloon 500 > Family Car 200, and > Pick-up 300
  "seat-wash", // Family Car 2500 > Pick-up 2000
];

/* ------------------------------------------------------------------ */
/* The price board — one price, not per vehicle type                   */
/* ------------------------------------------------------------------ */

/**
 * The rest of the board: items charged as a single figure regardless of
 * vehicle size, in the groups the board itself paints them in.
 */
export const flatPriceGroups: FlatPriceGroup[] = [
  {
    id: "carpets",
    name: "Carpets",
    rows: [
      { id: "carpet-small", name: "Small", priceKes: 500 }, // board
      /*
        board - BOTH READ AS 1000, and that may be one figure spanning two
        rows rather than two equal figures. Recorded as the board reads.

        The alternative was to treat "Large" as unread and null it, or to
        invent a higher number for it. Both are worse: 1000 is what is
        painted next to Large, and splitting it into a guessed 1200 would
        put an invented price on the site under the heading of a
        transcription. If a clearer photo shows a single merged cell, the
        fix is to merge these two rows, not to change either number.
      */
      { id: "carpet-medium", name: "Medium", priceKes: 1000 },
      { id: "carpet-large", name: "Large", priceKes: 1000 },
      {
        id: "carpet-sofa-set",
        name: "Sofa Set",
        // NOT READ - no legible value; this row looks cropped out of the
        // frame rather than illegible in it. Needs a photo that includes
        // the bottom of the carpets block, or in-person confirmation.
        priceKes: null,
      },
    ],
  },
  {
    id: "lorries",
    name: "Lorries",
    rows: [
      { id: "lorry-canter", name: "Canter", priceKes: 400 }, // board
      { id: "lorry-pr", name: "P.R.", priceKes: 500 }, // board
      { id: "lorry-fsr", name: "F.S.R.", priceKes: 600 }, // board
    ],
  },
  {
    id: "buses",
    name: "Buses",
    rows: [
      { id: "bus-mini", name: "Mini Bus", priceKes: 400 }, // board
      {
        id: "bus-full",
        name: "Bus",
        // NOT READ - no legible value, likely cropped out of frame. Needs a
        // clearer photo or in-person confirmation.
        priceKes: null,
      },
    ],
  },
  {
    id: "motorbikes",
    name: "Motorbike",
    rows: [{ id: "motorbike", name: "Motorbike", priceKes: 100 }], // board
  },
];

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

/**
 * The board read at one cell: a real KES figure, or `null` for a cell
 * nobody has transcribed yet.
 *
 * Every price the booking flow shows goes through here, which is what
 * makes "an unread cell can never be charged" a property of the code
 * rather than a habit — there is no second path that reads `row.prices`
 * directly and forgets the null.
 */
export function priceFor(
  row: WashPriceRow,
  vehicleTypeId: VehicleTypeId,
): PriceCell {
  return row.prices[vehicleTypeId];
}

/** True when this service can be booked online for this vehicle type. */
export function isBookable(
  row: WashPriceRow,
  vehicleTypeId: VehicleTypeId,
): boolean {
  return priceFor(row, vehicleTypeId) !== null;
}

export function getWashPriceRow(id: string): WashPriceRow | undefined {
  return washPriceRows.find((row) => row.id === id);
}

export function getVehicleType(id: string): VehicleType | undefined {
  return vehicleTypes.find((type) => type.id === id);
}

/**
 * The cheapest confirmed figure anywhere on the grid, for the home page's
 * "from KES ..." line.
 *
 * Computed rather than typed out. A hardcoded "from 200" is a number that
 * goes quietly wrong the first time a cell is corrected, and it would be
 * the one price on the site nothing could trace back to the board.
 *
 * Returns null if the grid somehow has no confirmed cell at all, so the
 * caller has to decide what to say rather than printing "from KES 0".
 */
export function cheapestConfirmedPriceKes(): number | null {
  const prices = washPriceRows
    .flatMap((row) => vehicleTypes.map((type) => priceFor(row, type.id)))
    .filter((price): price is number => price !== null);
  return prices.length > 0 ? Math.min(...prices) : null;
}
