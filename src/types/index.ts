/**
 * Shared domain types.
 *
 * Editable business content (hours, prices, services, products) lives in
 * `src/data/*`. This file only describes the shape of that content.
 */

/* ------------------------------------------------------------------ */
/* Business / scheduling                                               */
/* ------------------------------------------------------------------ */

/** 0 = Sunday ... 6 = Saturday (matches JS `Date.getDay()`). */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface DayHours {
  /** Opening time, 24h "HH:mm". Ignored when `closed` is true. */
  open: string;
  /** Closing time, 24h "HH:mm". The last slot must END by this time. */
  close: string;
  closed: boolean;
}

/* ------------------------------------------------------------------ */
/* Car wash                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* The wash price board                                                */
/* ------------------------------------------------------------------ */

/**
 * The three columns on the painted price board in the wash bay.
 *
 * Vehicle SIZE, not vehicle make: the board charges by how much car there
 * is to wash. "Family Car" is the board's own wording for an estate or SUV
 * and is kept verbatim — renaming it here would mean the site and the board
 * a customer is standing in front of disagree.
 */
export type VehicleTypeId = "saloon" | "family-car" | "pickup";

export interface VehicleType {
  id: VehicleTypeId;
  /** Exactly as painted on the board. */
  name: string;
}

/**
 * ONE PRICE CELL — A REAL FIGURE, OR NOTHING.
 *
 * `null` means "nobody has read this off the board yet". It does NOT mean
 * free, and it is never a guess standing in for a real number.
 *
 * This is the whole safety property of src/data/services.ts: a number in
 * that file came off the price board, so anything rendering one of these
 * cannot accidentally show an invented figure as though the yard had
 * confirmed it. Code that displays a cell must handle `null` — say the
 * price is not listed and point at the phone number, never print a zero.
 */
export type PriceCell = number | null;

/**
 * One row of the per-vehicle-type grid.
 *
 * NO PRICES ON IT ANY MORE. As of the price-tables migration the figures
 * live in `service_prices` in the database, keyed by this `id` crossed
 * with a vehicle type, and are read through a `PriceBook` (below). What
 * stays here is the part that is not the yard's to edit from a web form:
 * the id, the board's own wording, the row's position in the list, and
 * what it is known to subsume.
 *
 * The split is deliberate — a price is a business fact the yard changes
 * weekly; a service name is a transcription of what is painted on a wall.
 */
export interface WashPriceRow {
  id: string;
  /** Exactly as painted on the board. */
  name: string;
  /**
   * Which other rows this one already covers, so the picker does not charge
   * for the same work twice.
   *
   * THREE STATES, and the difference matters:
   *   undefined  no known overlap — the ordinary case, priced on its own
   *   string[]   CONFIRMED to include exactly these; the picker deselects
   *              and disables them while this row is selected
   *   null       the scope has NOT been confirmed. The picker warns that
   *              there may be an overlap and leaves the choice to the
   *              customer, rather than quietly removing a line nobody has
   *              established is included
   *
   * `null` exists for the same reason `PriceCell` allows it: a guessed
   * inclusion list silently removes money from a booking, which is a
   * costlier invention than a guessed price, not a cheaper one.
   */
  subsumes?: string[] | null;
}

/**
 * A board item priced as one figure rather than by vehicle size — carpets,
 * lorries, buses, motorbikes.
 */
export interface FlatPriceRow {
  id: string;
  /** Exactly as painted on the board. */
  name: string;
  /* Priced in `flat_prices`, keyed by `id`. See WashPriceRow above. */
}

/** A headed block of flat-priced items, in board order. */
export interface FlatPriceGroup {
  id: string;
  /** Exactly as painted on the board. */
  name: string;
  rows: FlatPriceRow[];
}

/* ------------------------------------------------------------------ */
/* The price book                                                      */
/* ------------------------------------------------------------------ */

/**
 * EVERY PRICE IN THE BUSINESS, READ ONCE.
 *
 * The three price tables collapsed into one plain object. It is built on
 * the server by `getPriceBook()` in src/lib/prices-db.ts and then handed
 * around — passed as a prop into the client components that need to
 * render or total prices, because those cannot reach the database
 * themselves and must never hold a key that could.
 *
 * PLAIN RECORDS RATHER THAN MAPS, and that is not a style choice: this
 * object crosses the server/client boundary as a prop, so it has to
 * survive JSON serialisation. A `Map` does not.
 *
 * `PriceCell` throughout, so `null` keeps meaning exactly what it means
 * everywhere else in this app — nobody has transcribed this cell. A
 * missing KEY means something different and worse: the id is not in the
 * database at all, which is a seeding gap rather than an unread cell. The
 * lookups in src/lib/prices.ts fold both to null, so no caller can print a
 * price for either.
 */
export interface PriceBook {
  /** Keyed `"<serviceId>:<vehicleTypeId>"`. */
  wash: Record<string, PriceCell>;
  /** Keyed by `FlatPriceRow.id`. */
  flat: Record<string, PriceCell>;
  /** Keyed by `Product.id`. */
  product: Record<string, PriceCell>;
}

/* ------------------------------------------------------------------ */
/* Concrete products                                                   */
/* ------------------------------------------------------------------ */

export type ProductCategoryId =
  | "fencing-posts"
  | "slabs"
  | "spindles"
  | "column-caps"
  | "road-kerbs";

export interface ProductCategory {
  id: ProductCategoryId;
  name: string;
  blurb: string;
}

/**
 * Manually-set fulfilment status. This is NOT inventory tracking — there
 * are no stock counts anywhere in this app by design. Someone at the yard
 * sets this field by hand in `src/data/products.ts`.
 */
export type FulfilmentStatus = "ready_to_ship" | "made_to_order";

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  /** URL segment: /products/[slug] */
  slug: string;
  categoryId: ProductCategoryId;
  name: string;
  description: string;
  /** e.g. "per piece", "per square metre". Shown next to the price. */
  unitLabel: string;
  /* Priced in `product_prices`, keyed by `id`. See WashPriceRow above. */
  status: FulfilmentStatus;
  /**
   * Bypasses the cart entirely and always routes to the quote form —
   * for bespoke or made-to-measure work that can't be priced up front.
   */
  quoteOnly: boolean;
  specs: ProductSpec[];
  /**
   * Photographs of this item, in the order they are shown. Paths under
   * /public, e.g. "/images/products/product-slab-02.jpg".
   *
   * An array rather than one path because these are real yard photos: the
   * same stack shot from two or three angles, and no single frame carries
   * the item on its own. Two or more entries turn on the slider controls in
   * ProductGallery; one entry renders a still; an empty array renders the
   * labelled placeholder block.
   *
   * Alt text is NOT stored here. It lives in `productPhotoAlt` in
   * src/data/products.ts, keyed by the same path, and is hand-written per
   * photo exactly as it is in src/data/property.ts — the frames in a set
   * differ enough from each other that a shared description would not
   * serve any of them.
   *
   * Keeping it in a separate map rather than turning this into
   * `{ src, alt }[]` is a deliberate deferral, not the end state: it adds
   * the missing text without reshaping the catalogue, which is tracked
   * separately. The cost is that a path can exist here with no entry
   * there — ProductGallery falls back to a weak derived label if so.
   */
  images: string[];
}

/* ------------------------------------------------------------------ */
/* Cart                                                                */
/* ------------------------------------------------------------------ */

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  unitLabel: string;
  priceKes: number;
  quantity: number;
  status: FulfilmentStatus;
  quoteOnly: boolean;
}

/* ------------------------------------------------------------------ */
/* Records created by the demo (mock persistence, see src/lib/store.ts) */
/* ------------------------------------------------------------------ */

export type PaymentStatus = "paid" | "pay_on_collection" | "unpaid";

/**
 * ONE STATUS CHANGE, AND THE NAME OF WHOEVER SAYS THEY MADE IT.
 *
 * Written by the staff view when someone changes a payment or quote status.
 * `by` comes from the "Acting as" field, which is SELF-REPORTED AND
 * UNVERIFIED — read the warning at the top of src/data/admin-users.ts
 * before relying on it for anything. It is a name tag, not an identity.
 */
export interface StatusChange {
  /**
   * The value the status was set TO, stored raw ("pay_on_collection",
   * not "Pay on arrival"). Raw because this is a record of what happened;
   * turning it into words is the reading end's job, and the wording on the
   * badges is free to change without rewriting history that is already
   * sitting in people's browsers.
   */
  to: string;
  /** Self-reported name, or `UNATTRIBUTED` if nobody had set one. */
  by: string;
  /** ISO 8601 timestamp of the change. */
  at: string;
}

/**
 * One service on a booking, priced for the vehicle type that was chosen.
 *
 * The price is COPIED onto the record rather than looked up later. A
 * booking is what was agreed on the day; if the board is repainted next
 * month, a receipt printed from an old booking has to keep saying what the
 * customer actually paid.
 */
export interface BookingLine {
  /** Matches a `WashPriceRow.id` in src/data/services.ts. */
  serviceId: string;
  /** The board name as it read when the booking was made. */
  name: string;
  /** KES, for the booking's vehicle type. Never null — an unread cell
   *  cannot be selected, so it cannot reach a booking. */
  priceKes: number;
}

export interface Booking {
  ref: string;

  /*
    THE PRICE-BOARD FIELDS.
    ------------------------------------------------------------------
    All three are OPTIONAL, and not because they are optional to fill in.
    Bookings live in the visitor's own localStorage (src/lib/store.ts), so
    every booking made before the price board was wired in is still sitting
    in somebody's browser with `serviceName` and no `lines`. Readers must
    handle both shapes, and there is exactly one place that does:
    `bookingLines` / `bookingVehicleTypeName` in src/lib/booking.ts. Read
    through those rather than touching these fields directly.
  */

  /** Which board column priced this booking. */
  vehicleTypeId?: VehicleTypeId;
  /** The column's name as it read at the time, e.g. "Family Car". */
  vehicleTypeName?: string;
  /** The services chosen, in board order. At least one on a new booking. */
  lines?: BookingLine[];

  /*
    LEGACY, from the three invented tiers that predated the price board.
    Never written by new bookings. Present only on records already in a
    visitor's storage, where they are the only description of what was
    booked — which is why they are read rather than dropped.
  */
  serviceId?: string;
  serviceName?: string;

  /** The whole booking: the sum of every line. */
  priceKes: number;
  durationMinutes: number;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:mm" */
  startTime: string;
  /** "HH:mm" */
  endTime: string;
  customerName: string;
  phone: string;
  vehicle: string;
  notes: string;
  paymentStatus: PaymentStatus;
  createdAt: string;
  /**
   * Status changes made in the staff view, MOST RECENT FIRST.
   *
   * Optional because it is absent on two ordinary cases, not just old data:
   * a record nobody has touched yet, and every record created before this
   * field existed — which includes whatever is already in a visitor's
   * localStorage right now. Readers must handle it being undefined.
   */
  history?: StatusChange[];
}

export interface Order {
  ref: string;
  lines: CartLine[];
  subtotalKes: number;
  customerName: string;
  phone: string;
  deliveryLocation: string;
  notes: string;
  paymentStatus: PaymentStatus;
  createdAt: string;
  /**
   * Status changes made in the staff view, MOST RECENT FIRST.
   *
   * Optional because it is absent on two ordinary cases, not just old data:
   * a record nobody has touched yet, and every record created before this
   * field existed — which includes whatever is already in a visitor's
   * localStorage right now. Readers must handle it being undefined.
   */
  history?: StatusChange[];
}

export type QuoteStatus = "new" | "contacted" | "quoted" | "closed";

export interface QuoteRequest {
  ref: string;
  customerName: string;
  phone: string;
  /** Free text describing what they want made. */
  item: string;
  quantity: string;
  deliveryLocation: string;
  notes: string;
  status: QuoteStatus;
  createdAt: string;
  /** Populated when the request came from an over-threshold cart. */
  lines: CartLine[];
  /**
   * Status changes made in the staff view, MOST RECENT FIRST.
   *
   * Optional because it is absent on two ordinary cases, not just old data:
   * a record nobody has touched yet, and every record created before this
   * field existed — which includes whatever is already in a visitor's
   * localStorage right now. Readers must handle it being undefined.
   */
  history?: StatusChange[];
}

/* ------------------------------------------------------------------ */
/* Staged content-change requests                                      */
/* ------------------------------------------------------------------ */

/**
 * A REQUEST TO CHANGE THE SITE. NOT A CHANGE TO THE SITE.
 *
 * Nothing in this file, and nothing in the staff view that renders it, is
 * wired to the catalogue. Prices live in src/data/services.ts and
 * src/data/products.ts, they are compiled into the build, and the only way
 * one of them moves is a developer editing that file and redeploying.
 *
 * These records exist so the yard can say what it wants changed WITHOUT
 * waiting to catch the developer on the phone, and so the asking is written
 * down instead of living in a WhatsApp thread nobody can search. The status
 * below tracks the asking, not the doing.
 *
 * The wording on screen says all of this, in the banner above the section
 * and again on every single card — see the note in
 * src/lib/change-requests.ts about why it is repeated rather than said once.
 */
/**
 * TWO KINDS. "price" IS GONE, AND ON PURPose — it was removed rather than
 * hidden.
 *
 * Asking a developer to change a price made sense while prices were
 * compiled into the build. They are rows in `service_prices`,
 * `flat_prices` and `product_prices` now, and the staff view edits them
 * directly and live. A request to change something you can simply change
 * is a queue that exists for no reason, and the worst version of it is one
 * where a staff member drafts a request and waits for a price they could
 * have set themselves.
 *
 * What is left is the two things this app genuinely cannot do to itself: a
 * product that does not exist in src/data/products.ts, and a stock state
 * the catalogue has no field for.
 */
export type ChangeRequestKind = "new_item" | "stock";

/**
 * TWO STATES, AND "SENT" IS SELF-REPORTED.
 *
 * `sent` means a member of staff pressed "Mark sent" after copying the text
 * somewhere. It is a tick on their own list — there is no delivery receipt
 * behind it, nothing checks that a message was really sent, and the
 * developer's end of it is not represented here at all. A request can sit
 * at `sent` for a month without anybody having read it.
 *
 * Deliberately NOT a third "applied" state. This app cannot know when a
 * change has gone live — that happens in a code deploy it has no sight of —
 * and a status nobody can set truthfully is worse than no status.
 */
export type ChangeRequestStatus = "draft" | "sent";

/** What every request carries, whatever it is asking for. */
interface ChangeRequestBase {
  ref: string;
  status: ChangeRequestStatus;
  createdAt: string;
  /**
   * Self-reported name from "Acting as", or `UNATTRIBUTED`. Same caveat as
   * everywhere else in this app — see src/data/admin-users.ts.
   */
  by: string;
  /** Free text. Always present, often empty. */
  note: string;
  /** Status changes, most recent first. Optional; see `QuoteRequest`. */
  history?: StatusChange[];
}

/**
 * "We sell something the site does not list."
 *
 * `categoryId` is a real `ProductCategoryId` or the literal "other", in
 * which case `otherCategory` carries what staff typed. A genuinely new
 * category is a real thing that happens in this yard, and forcing it into
 * one of the five that exist would file the request under a heading the
 * developer then has to undo.
 */
export interface NewItemRequest extends ChangeRequestBase {
  kind: "new_item";
  name: string;
  categoryId: ProductCategoryId | "other";
  /** Only meaningful when `categoryId` is "other". */
  otherCategory: string;
  proposedPriceKes: number;
  description: string;
  /** Staff ticked "we still owe you a photo of this". */
  photoNeeded: boolean;
}

/**
 * "Stop offering this" / "start offering it again".
 *
 * Products only. The wash services are not stocked — a bay either runs or
 * it does not, and that is an opening-hours question, not this one.
 */
export interface StockChangeRequest extends ChangeRequestBase {
  kind: "stock";
  /** A `Product.id` from src/data/products.ts. */
  subjectId: string;
  subjectLabel: string;
  intent: "out_of_stock" | "back_in_stock";
}

export type ChangeRequest = NewItemRequest | StockChangeRequest;
