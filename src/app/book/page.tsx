import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { hoursSummary } from "@/data/business";
import { cheapestConfirmedPriceKes } from "@/lib/prices";
import { getPriceBook } from "@/lib/prices-db";
import { formatKes } from "@/lib/format";
import { BookingFlow } from "./BookingFlow";

/**
 * /book — ONE PAGE, THE WHOLE FLOW.
 *
 * There used to be a service index here and a page per service at
 * /book/[serviceId]. Both are gone. Those three services were invented
 * before anyone had seen the price board and the yard does not sell them;
 * the real board prices eleven services against three vehicle sizes, and
 * a URL per service would now mean thirty-three pages for what is one
 * question with two parts. The picker asks both on the first step.
 *
 * The old /book/exterior-wash URLs 404 rather than redirecting anywhere.
 * They were live for a demo build only, nothing links to them, and a
 * redirect from an invented service to a real price list would silently
 * answer a question the visitor did not ask.
 */

/**
 * The title picks up "| Timalen Auto & Concrete" from the template in
 * src/app/layout.tsx, so it is set here WITHOUT the business name — adding
 * it would print the name twice.
 *
 * PRICES ARE ABSENT FROM THE DESCRIPTION. A description is the line a
 * search engine quotes verbatim, and the board's prices depend on the
 * vehicle — a single figure lifted out of the grid and printed in a search
 * result is a price the business has effectively advertised for vehicles it
 * does not apply to. The vehicle columns are named instead, which is the
 * useful half.
 */
export const metadata: Metadata = {
  title: "Book a wash",
  description:
    "Book a slot at the wash bay. Pick your vehicle — saloon, family car or pick-up — then the services you need, from a body wash to polishing, and choose a time. One bay, so each slot is held for a single vehicle.",
  alternates: { canonical: "/book" },
  openGraph: {
    title: "Book a wash",
    description:
      "Pick your vehicle type, the services you need and a time at the wash bay. One bay, one vehicle per slot.",
    url: "/book",
  },
};

/**
 * Per request. The picker below is priced from the database, so this page
 * cannot be built once at deploy time — see the note on /prices.
 */
export const dynamic = "force-dynamic";

export default async function BookPage() {
  const priceBook = await getPriceBook();
  const from = cheapestConfirmedPriceKes(priceBook);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        eyebrow="Wash bay"
        title="Book a Wash"
        backHref="/"
        backLabel="Home"
        intro={
          <>
            <p>
              Pick your vehicle and what you need doing, then choose a time.
              There is one bay, so each slot is held for a single vehicle.{" "}
              {hoursSummary}.
            </p>
            <p className="mt-2 text-sm">
              {/*
                `from` is computed off the board rather than typed out, so it
                cannot drift from the grid. Null would mean the grid has no
                confirmed cell at all — the sentence is dropped rather than
                printing "from KES 0".
              */}
              {from !== null ? `Prices start at ${formatKes(from)}. ` : null}
              <Link
                href="/prices"
                className="font-bold underline underline-offset-4 hover:text-slab-900"
              >
                See the full price board
              </Link>{" "}
              — including carpets, lorries, buses and motorbikes, which are
              not bookable online.
            </p>
          </>
        }
      />

      <BookingFlow priceBook={priceBook} />
    </div>
  );
}
