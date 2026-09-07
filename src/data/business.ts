/**
 * BUSINESS IDENTITY + OPERATING HOURS
 *
 * Everything a non-developer needs to change about "who we are and when
 * we're open" lives in this file. No component hardcodes any of it.
 *
 * TODO / CONFIRM WITH CLIENT — the trading name, the two phone numbers, the
 * till number, the town and the domain are confirmed. Still missing: the
 * tagline, the street/plot half of the address, and the email — which is
 * now BLANK rather than fake; see the note on that field below.
 */

import type { DayHours, WeekdayIndex } from "@/types";

/* ------------------------------------------------------------------ */
/* Where the yard is                                                   */
/* ------------------------------------------------------------------ */

/**
 * POSTAL ADDRESS — PARTIALLY FILLED IN.
 *
 * These fields feed the `address` block of the LocalBusiness JSON-LD in
 * src/app/layout.tsx, and `locationLabel` below builds the human-readable
 * line from the same values, so the town is stated in exactly one place.
 *
 * A structured address is the wrong place to guess: it is machine-read, it
 * is what a search engine plots on a map, and a fabricated street would
 * send customers to the wrong place with the business's own markup
 * vouching for it. So a field nobody has confirmed stays empty, and both
 * the markup and the on-page line simply leave it out.
 *
 * CONFIRMED: the town is Maua.
 *
 * TO FILL IN: the street/plot and the county, once the client gives them.
 * `geo` is optional — add it only from a real map pin, never from a
 * town-centre guess.
 */
export const businessAddress = {
  /** e.g. "Plot 14, Kenyatta Road". TODO: ask the client. */
  street: "",
  /** CONFIRMED. */
  town: "Maua",
  /** e.g. "Meru". TODO: confirm against the client's own stationery. */
  county: "",
  country: "KE",
} as const;

/**
 * ISO country code -> the word a customer reads. One entry is all this
 * business needs; it exists so the country is never spelled out next to a
 * code that contradicts it.
 */
const COUNTRY_NAMES: Record<string, string> = { KE: "Kenya" };

/**
 * The address as a sentence — "Maua, Kenya" today, "Plot 14 Kenyatta Road,
 * Maua, Kenya" the day the street lands. Empty parts are dropped rather
 * than joined, so a half-filled address renders as a shorter true line and
 * never as a dangling comma or a stray "[Town]".
 *
 * The country rides along with the town rather than standing alone: with
 * no town at all, "Kenya" is not a place anybody can bring a car to, and
 * the honest output is nothing.
 */
export const locationLabel: string = businessAddress.town
  ? [
      businessAddress.street,
      businessAddress.town,
      COUNTRY_NAMES[businessAddress.country] ?? "",
    ]
      .filter(Boolean)
      .join(", ")
  : "";

/**
 * True only when a FULL street-level address has been supplied.
 *
 * The cast on the town is the same trick as `hasTillNumber` below, and for
 * the same reason: `as const` narrows `town` to the literal "Maua", against
 * which `!== ""` is a comparison TypeScript settles at compile time and
 * rejects as pointless (TS2367). Widening to `string` puts the check back
 * at runtime, where it belongs — this flag must keep working for whoever
 * blanks the field later.
 */
export const hasRealAddress =
  businessAddress.street !== "" && (businessAddress.town as string) !== "";

/* ------------------------------------------------------------------ */
/* How to reach the yard                                               */
/* ------------------------------------------------------------------ */

/**
 * THE TWO LINES THE YARD ANSWERS — SUPPLIED BY THE CLIENT.
 *
 * Both are WhatsApp numbers, which is how most of this customer base
 * actually makes contact. `display` is what a human reads, and what the
 * `tel:` link carries once the spaces are stripped; `whatsapp` is the same
 * number in the form wa.me demands — country code, digits only, no plus
 * and no spaces. Both spellings are stored rather than one derived from
 * the other: the conversion needs a rule about the leading zero that would
 * be wrong the first time somebody adds a non-Kenyan number.
 *
 * LABELS ARE PLAIN ON PURPOSE. The business runs two trades and the yard
 * carries two signs (see src/data/property.ts), so "Car wash" and
 * "Concrete" would be the tempting labels — but nobody has told us these
 * numbers split that way, and a wrong label sends a concrete enquiry to
 * whoever is holding the wash-bay phone. Relabel these the moment the
 * client says which line is which; nothing else needs to change.
 *
 * ORDER MATTERS. The first entry is the primary: it is what `business.phone`
 * and `business.whatsapp` resolve to, what the JSON-LD publishes as the
 * telephone, and what prints on receipts.
 */
export const contactNumbers = [
  {
    label: "WhatsApp",
    display: "+254 721 726578",
    whatsapp: "254721726578",
  },
  {
    label: "Alt WhatsApp",
    display: "+254 727 412244",
    whatsapp: "254727412244",
  },
] as const;

/** The number to try first. */
const primaryContact = contactNumbers[0];

/** `tel:` href for a displayed number — strips the spaces, keeps the `+`. */
export function telHref(display: string): string {
  return `tel:${display.replace(/\s/g, "")}`;
}

/** Click-to-chat href. Takes the digits-only form, not the display one. */
export function whatsappHref(whatsapp: string): string {
  return `https://wa.me/${whatsapp}`;
}

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

export const business = {
  /**
   * CONFIRMED. The yard's own signage carries two names — "Timalen Auto
   * Cleaners" over the wash bay and "Timalen General Suppliers" on the
   * concrete side (see the photographs described in src/data/property.ts).
   * This is the one name that covers both trades, and it is what the site
   * trades under.
   */
  name: "Timalen Auto & Concrete",

  /** TODO: confirm. Appears under the logo in the header and in the footer. */
  tagline: "Car wash and concrete works, one yard",

  /**
   * Built from `businessAddress` above — do not edit here. Reads "Maua,
   * Kenya" while the street is still missing.
   */
  location: locationLabel,

  /** CONFIRMED. The primary line; see `contactNumbers` above. */
  phone: primaryContact.display,

  /** CONFIRMED. The primary line again, in wa.me form. */
  whatsapp: primaryContact.whatsapp,

  /**
   * NO CONFIRMED EMAIL — DELIBERATELY BLANK.
   *
   * This held "hello@example.co.ke", which SiteFooter published as a live
   * `mailto:` link. That is worse than showing no email at all, on two
   * counts. A customer who writes to it is talking to nobody and concludes
   * the yard ignored them — a bounced enquiry is a lost one. And unlike
   * example.com, which IANA reserves precisely so it can never resolve,
   * nothing reserves example.co.ke: the address may deliver to a stranger.
   *
   * An address on the new domain is the obvious guess and is exactly the
   * guess not to make. info@timalen.online is a mailbox nobody has told us
   * exists, and inventing it fails the same silent way as the last one.
   *
   * So it stays empty, like `businessAddress.street` above and for the
   * same reason. `hasEmail` below gates the footer line, which drops out
   * whole rather than rendering a dead link. Fill this in and the line
   * comes back; nothing else needs to change.
   */
  email: "",

  /**
   * M-PESA BUY GOODS TILL — SUPPLIED BY THE CLIENT.
   *
   * This is a BUY GOODS till, not a paybill. The distinction is the whole
   * reason the wording around it is specific: the customer picks "Buy Goods
   * and Services" on the M-Pesa menu, enters this number, and is never
   * asked for an account or reference. Anywhere this renders says so — a
   * customer hunting for an account field that does not exist either
   * abandons the payment or invents a reference nobody can reconcile.
   *
   * Worth one check against the client's own M-Pesa statement rather than a
   * number read down a phone. This is still the one field in this file that
   * moves money, and a wrong digit sends it to a stranger with this
   * business's name on the receipt.
   *
   * The guard in src/components/Receipt.tsx stays regardless: blank this
   * and the M-Pesa line drops out whole, rather than printing a payment
   * instruction with the number missing from the end of it.
   */
  tillNumber: "9806711",

  /**
   * CONFIRMED — the registered domain.
   *
   * Read as `metadataBase` in src/app/layout.tsx, and as the base for
   * app/sitemap.ts and app/robots.ts, all of which need absolute URLs.
   * Every canonical tag, every sitemap entry and the Sitemap: line in
   * robots.txt is built from this one string, so it has to match the
   * origin the site is actually served from — scheme included, and `www.`
   * included or omitted to match, because a search engine reads
   * https://www.timalen.online as a different site from this one.
   *
   * NO TRAILING SLASH. sitemap.ts and robots.ts each strip one defensively
   * while `new URL()` in layout.tsx does not, so a slash here would leave
   * the three disagreeing about what the base looks like. Keep it bare.
   */
  siteUrl: "https://timalen.online",
} as const;

/**
 * True only when an email address has been supplied. Gates the mailto line
 * in src/components/SiteFooter.tsx; see the note on `email` above.
 *
 * Same cast as `hasTillNumber` below, and for the same reason: `as const`
 * pins `email` to a literal, and widening to `string` puts the check back
 * at runtime, where it keeps working for whoever fills the field in.
 */
export const hasEmail: boolean = (business.email as string) !== "";

/**
 * True only when a till number has been supplied. Gates the "Pay by M-Pesa"
 * line on printed receipts; see the note on `tillNumber` above.
 *
 * The cast is what keeps that guard alive. `as const` narrows `tillNumber`
 * to the literal "9806711", against which `!== ""` is a comparison TypeScript
 * can settle at compile time and rejects as pointless (TS2367). Widening to
 * `string` puts the check back where it belongs — at runtime, for whoever
 * blanks the field later.
 */
export const hasTillNumber: boolean = (business.tillNumber as string) !== "";

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
