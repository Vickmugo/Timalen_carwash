/**
 * =====================================================================
 * THE WASH PRICE BOARD
 * ---------------------------------------------------------------------
 * The painted board in the wash bay, transcribed from a photo. This file
 * holds the board's STRUCTURE — which services exist, their ids, the
 * wording painted on the wall, and the order of the rows. The PRICES moved
 * to the database (`service_prices` / `flat_prices`) so the yard can edit
 * them from the staff view without a deploy; read them through
 * src/lib/prices.ts. /book, /prices and the home page combine the two.
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

import { bookingConfig } from "@/data/config";
import type {
  FlatPriceGroup,
  FlatPriceRow,
  FlatVehicle,
  VehicleType,
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
 * The grid, in board order. STRUCTURE ONLY — THE PRICES ARE NOT HERE.
 *
 * Every figure moved to `service_prices` in the database, where the yard
 * edits it directly from the staff view (see
 * supabase/migrations/20260907150000_price_tables.sql). What remains is
 * the part that is not the yard's to change from a web form: each row's
 * id, the board's own wording, the order they are painted in, and what a
 * row is known to subsume.
 *
 * All eleven rows are listed, including the three — Interior Wash,
 * Complete Wash, Buffing — whose cells nobody has read. Their POSITION on
 * the board is known even where their prices are not, and dropping them
 * would lose that along with the fact that they are missing at all. They
 * are seeded as null cells rather than absent rows, so the staff view can
 * offer them to be filled in.
 */
export const washPriceRows: WashPriceRow[] = [
  { id: "body-wash", name: "Body Wash" },
  { id: "engine-wash", name: "Engine Wash" },
  { id: "under-wash", name: "Under Wash" },
  { id: "dry-vacuum", name: "Dry Vacuum" },
  { id: "wet-vacuum", name: "Wet Vacuum" },
  { id: "polishing", name: "Polishing" },
  { id: "roof-wash", name: "Roof Wash" },
  { id: "seat-wash", name: "Seat Wash" },
  { id: "interior-wash", name: "Interior Wash" },
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

      Inert while this row has no price in any column, since it cannot then
      be selected at all — but that is now a fact about the database rather
      than about this file, and the yard can change it from the staff view
      at any time. The warning above is live code, not a dormant branch.
    */
    subsumes: null,
  },
  { id: "buffing", name: "Buffing" },
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
 *
 * Structure only, like the grid above. The figures live in `flat_prices`.
 */
export const flatPriceGroups: FlatPriceGroup[] = [
  {
    id: "carpets",
    name: "Carpets",
    rows: [
      { id: "carpet-small", name: "Small" },
      /*
        Medium and Large both read 1000 on the board, which may be one
        figure spanning two rows rather than two equal figures. Both are
        seeded as read. If a clearer photo shows a single merged cell, the
        fix is to MERGE THESE TWO ROWS here — a structural change, which is
        why the note stays in this file even though the numbers left it.
      */
      { id: "carpet-medium", name: "Medium" },
      { id: "carpet-large", name: "Large" },
      // Cropped out of frame rather than illegible in it; seeded null.
      { id: "carpet-sofa-set", name: "Sofa Set" },
    ],
  },
  {
    id: "lorries",
    name: "Lorries",
    rows: [
      { id: "lorry-canter", name: "Canter" },
      { id: "lorry-pr", name: "P.R." },
      { id: "lorry-fsr", name: "F.S.R." },
    ],
  },
  {
    id: "buses",
    name: "Buses",
    rows: [
      { id: "bus-mini", name: "Mini Bus" },
      // Likely cropped out of frame; seeded null.
      { id: "bus-full", name: "Bus" },
    ],
  },
  {
    id: "motorbikes",
    name: "Motorbike",
    rows: [{ id: "motorbike", name: "Motorbike" }],
  },
];


/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

/**
 * WHERE THE PRICE LOOKUPS WENT.
 *
 * `priceFor`, `isBookable` and `cheapestConfirmedPriceKes` used to live
 * here, reading numbers straight off the rows above. The numbers are in
 * the database now, so their replacements take a `PriceBook` and live in
 * src/lib/prices.ts — `washPrice`, `isBookable`, `flatPrice`,
 * `productPrice`, `cheapestConfirmedPriceKes`.
 *
 * That file is deliberately pure and free of any database import, so the
 * booking picker in the browser and the route handler that prices the
 * booking for real run the same lookup over the same book. What stays
 * here is what this file is still the source of truth for: structure.
 */

/* ------------------------------------------------------------------ */
/* Flat-priced vehicles the booking form offers                        */
/* ------------------------------------------------------------------ */

/**
 * VEHICLES /book OFFERS BESIDE THE GRID'S THREE COLUMNS.
 *
 * Each points at a group above rather than carrying rows of its own, so
 * the board stays the one place a size is named. The picker lists these
 * after Saloon / Family Car / Pick-up, in this order.
 *
 * NOT CARPETS. A carpet is not a vehicle and does not occupy the bay for a
 * slot; it goes through the drop-off request instead.
 *
 * LORRIES AND BUSES hold the bay for the longer placeholder block. Each
 * has several sizes on the board, so the customer picks one. Full-size Bus
 * has no legible price and is shown but cannot be booked — it becomes
 * bookable the moment a figure is entered in the staff price editor, with
 * no code change, because an unread size is refused by the same null
 * check as an unread grid cell.
 */
export const flatVehicles: FlatVehicle[] = [
  { id: "motorbike", name: "Motorbike", groupId: "motorbikes" },
  {
    id: "lorry",
    name: "Lorry",
    groupId: "lorries",
    durationMinutes: bookingConfig.placeholderLargeVehicleDurationMinutes,
  },
  {
    id: "bus",
    name: "Bus",
    groupId: "buses",
    durationMinutes: bookingConfig.placeholderLargeVehicleDurationMinutes,
  },
];

export function getFlatVehicle(id: string): FlatVehicle | undefined {
  return flatVehicles.find((vehicle) => vehicle.id === id);
}

/** The priced sizes of a flat vehicle, in board order. */
export function flatVehicleRows(vehicle: FlatVehicle): FlatPriceRow[] {
  return flatPriceGroups.find((group) => group.id === vehicle.groupId)?.rows ?? [];
}

export function getWashPriceRow(id: string): WashPriceRow | undefined {
  return washPriceRows.find((row) => row.id === id);
}

export function getVehicleType(id: string): VehicleType | undefined {
  return vehicleTypes.find((type) => type.id === id);
}
