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

export interface WashService {
  id: string;
  name: string;
  description: string;
  /** Price in Kenyan Shillings (whole shillings, no cents). */
  priceKes: number;
  /**
   * How long the bay is occupied by this service, in minutes.
   *
   * Deliberately per-service rather than one global constant: only the
   * entry tier is confirmed at 30 minutes. A longer service (wash + wax)
   * can be given its own duration here without touching booking logic.
   */
  durationMinutes: number;
  /** Bullet points shown on the service card. */
  includes: string[];
}

/* ------------------------------------------------------------------ */
/* Concrete products                                                   */
/* ------------------------------------------------------------------ */

export type ProductCategoryId = "cabros" | "fencing-posts" | "decorations";

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
  priceKes: number;
  status: FulfilmentStatus;
  /**
   * Bypasses the cart entirely and always routes to the quote form —
   * for bespoke or made-to-measure work that can't be priced up front.
   */
  quoteOnly: boolean;
  specs: ProductSpec[];
  /**
   * Path under /public once a real photo exists,
   * e.g. "/images/products/cabro-standard-60mm.jpg".
   * `null` renders a labelled placeholder block instead.
   */
  image: string | null;
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

export interface Booking {
  ref: string;
  serviceId: string;
  serviceName: string;
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
}
