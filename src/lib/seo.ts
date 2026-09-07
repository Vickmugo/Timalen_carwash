/**
 * SEO HELPERS — page titles and the LocalBusiness structured data.
 *
 * Everything here is DERIVED from src/data/business.ts. Nothing in this
 * file invents a fact about the business, and that is the whole design
 * rule: structured data is machine-read and is what a search engine will
 * repeat back to a customer in a result card, on a map, or out loud. A
 * placeholder that reaches this file stops being a note-to-self and starts
 * being a claim.
 *
 * So every field that is still a placeholder is OMITTED rather than
 * emitted. An incomplete LocalBusiness record is valid and honest; a
 * complete-looking one built out of "[Street]" and "07XX XXX XXX" is
 * neither. Each omission below is guarded and commented, and each one
 * starts working by itself the moment the real value lands in business.ts
 * — there is no second place to remember to update.
 */

import {
  WEEKDAY_NAMES,
  business,
  businessAddress,
  hasRealAddress,
  operatingHours,
} from "@/data/business";
import type { WeekdayIndex } from "@/types";

/**
 * A value is still a placeholder if it carries the marker characters the
 * data file uses: square brackets ("[Town]") or a run of capital X's
 * standing in for digits ("07XX XXX XXX", "2547XXXXXXXX").
 */
function isPlaceholder(value: string): boolean {
  return /\[|\]|XX/.test(value);
}

/** Undefined for anything still unconfirmed, so callers can simply omit it. */
function realOrUndefined(value: string): string | undefined {
  return isPlaceholder(value) ? undefined : value;
}

/* ------------------------------------------------------------------ */
/* Opening hours -> schema.org                                         */
/* ------------------------------------------------------------------ */

interface OpeningHoursSpecification {
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

/**
 * One entry per DISTINCT open/close pair rather than one per day, so the
 * usual "Mon-Sat 08:00-18:00" emits a single grouped specification instead
 * of six near-identical ones. Closed days are left out entirely, which is
 * how schema.org expresses "closed" — by absence, not by a zero-length
 * interval.
 */
export function openingHoursSpecification(): OpeningHoursSpecification[] {
  const groups = new Map<string, OpeningHoursSpecification>();

  for (let day = 0; day < 7; day += 1) {
    const hours = operatingHours[day as WeekdayIndex];
    if (hours.closed) continue;

    const key = `${hours.open}-${hours.close}`;
    const existing = groups.get(key);

    if (existing) {
      existing.dayOfWeek.push(WEEKDAY_NAMES[day]);
    } else {
      groups.set(key, {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [WEEKDAY_NAMES[day]],
        opens: hours.open,
        closes: hours.close,
      });
    }
  }

  return [...groups.values()];
}

/* ------------------------------------------------------------------ */
/* LocalBusiness                                                       */
/* ------------------------------------------------------------------ */

/**
 * The LocalBusiness record for the yard, rendered once in the root layout.
 *
 * TYPE — two types, because this is genuinely two trades on one premise.
 * schema.org allows an array, and `AutoWash` is the specific subtype for a
 * car wash; the concrete side has no matching subtype, so it is carried by
 * `LocalBusiness` plus the description. Claiming only one of the two would
 * describe half the business.
 *
 * WHAT IS DELIBERATELY MISSING, and why (see the file header):
 *   address   omitted until `businessAddress` has a STREET. The town is
 *             confirmed (Maua) and renders on the page, but this is the
 *             field a search engine plots on a map, and half a postal
 *             address is the half that puts the pin in the wrong place.
 *             A locality-only PostalAddress would be valid and honest and
 *             is worth adding — deliberately not done here, so that the
 *             markup changes once, when the full address arrives.
 *   telephone NOW EMITTED. The primary line in src/data/business.ts is
 *             confirmed, so the guard below passes; it stays in place
 *             because a placeholder in this field is a number something
 *             will dial.
 *   geo       never derived. It comes from a real map pin or not at all.
 *   url       always emitted, and `business.siteUrl` is now the real
 *             registered domain.
 *   email     never emitted. There is no confirmed address — see the note
 *             in src/data/business.ts — and an invented one in structured
 *             markup is a contact route a machine will hand out.
 */
export function localBusinessJsonLd() {
  const telephone = realOrUndefined(business.phone);

  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "AutoWash"],
    name: business.name,
    description: business.tagline,
    url: business.siteUrl,
    openingHoursSpecification: openingHoursSpecification(),
    currenciesAccepted: "KES",

    // Spread rather than assigned, so an unconfirmed value produces NO KEY
    // AT ALL rather than an empty string. `"telephone": ""` is a worse
    // record than no telephone: it asserts that the business has no number.
    ...(telephone ? { telephone } : {}),
    ...(hasRealAddress
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: businessAddress.street,
            addressLocality: businessAddress.town,
            addressRegion: businessAddress.county,
            addressCountry: businessAddress.country,
          },
        }
      : {}),
  };
}

/**
 * Rendered into a `<script type="application/ld+json">`.
 *
 * `<` is escaped so a stray value can never close the script tag early —
 * the standard XSS guard for inline JSON-LD. Nothing in business.ts
 * contains one today; this costs nothing and does not depend on that
 * staying true.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
