/**
 * The walk-in constants both sides need, with no imports, so the staff
 * form can use them without pulling src/lib/walkin.ts (and the server
 * helpers it uses) into the browser bundle.
 */

/** Stored when staff leave the name blank. */
export const WALKIN_DEFAULT_NAME = "Customer";

/** Kenyan plates are 7–8 characters; this leaves room for a foreign one. */
export const PLATE_MAX = 15;

export const OUTSIDE_HOURS_MESSAGE = "This is outside opening hours. Register anyway?";
