import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/Button";
import { business, telHref, whatsappHref } from "@/data/business";
import { flatPriceGroups, vehicleTypes, washPriceRows } from "@/data/services";
import { flatPrice, washPrice } from "@/lib/prices";
import { getPriceBook } from "@/lib/prices-db";
import { formatKes } from "@/lib/format";
import type { PriceCell } from "@/types";

/**
 * =====================================================================
 * /prices — THE BOARD, AS IT IS PAINTED
 * ---------------------------------------------------------------------
 * The whole wash price board on one public page: the eleven services
 * across three vehicle sizes, then the flat-priced work — carpets,
 * lorries, buses, motorbikes — that is not priced by car size at all.
 *
 * WHY IT EXISTS SEPARATELY FROM /book. Checking a price and making a
 * booking are different errands. Somebody deciding whether to drive over
 * should not have to start a booking flow, pick a vehicle and read a
 * checklist to find out what a body wash costs; and the flat-priced items
 * are not bookable online at all, so they have nowhere else to appear.
 *
 * UNREAD CELLS SAY SO. A cell nobody has transcribed prints "Ask at the
 * yard", never a dash that reads as free and never a guessed number. Same
 * rule as everywhere else — see the header of src/data/services.ts.
 *
 * A REAL <table>, not a grid of divs: this is tabular data with row and
 * column headers, and a screen reader announcing "Body Wash, Family Car,
 * KES 300" depends on the markup actually saying so. It falls back to
 * stacked cards on a phone through the same `record-table` class the staff
 * view uses (src/app/globals.css).
 * =====================================================================
 */

export const metadata: Metadata = {
  title: "Wash prices",
  description:
    "The full price list from the wash bay: body wash, engine wash, under wash, vacuuming, polishing, roof and seat washes priced for saloons, family cars and pick-ups, plus carpets, lorries, buses and motorbikes.",
  alternates: { canonical: "/prices" },
  openGraph: {
    title: "Wash prices",
    description:
      "Every price from the board at the wash bay, for saloons, family cars and pick-ups.",
    url: "/prices",
  },
};

/** One price, or the honest absence of one. */
function Price({ value }: { value: PriceCell }) {
  if (value === null) {
    return (
      <span className="text-xs font-bold uppercase tracking-wide text-slab-500">
        Ask at the yard
      </span>
    );
  }
  return <span className="font-bold">{formatKes(value)}</span>;
}

const cell = "px-3 py-2.5 text-sm";

/**
 * RENDERED PER REQUEST, not prerendered.
 *
 * This page was static: the prices were compiled constants, so the whole
 * board could be built once at deploy time. They are rows now, editable
 * from the staff view, and a cached copy of this page is a price list
 * that disagrees with what the booking form will actually charge. Live
 * editing and static generation cannot both be true, and the brief asked
 * for the first.
 */
export const dynamic = "force-dynamic";

export default async function PricesPage() {
  const priceBook = await getPriceBook();
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        eyebrow="Wash bay"
        title="Wash Prices"
        backHref="/"
        backLabel="Home"
        intro={
          <p>
            The board at the bay, in full. Prices are in Kenyan Shillings and
            depend on the size of the vehicle.
          </p>
        }
      />

      {/* ------------------------- The grid ------------------------- */}
      <section className="mt-8" aria-labelledby="prices-vehicles">
        <h2 id="prices-vehicles" className="text-xl">
          Cars, by size
        </h2>

        <div className="mt-3 rounded-slab border-2 border-slab-300 bg-white p-3 md:overflow-x-auto md:p-0">
          <table className="record-table w-full border-collapse md:min-w-[34rem]">
            <thead className="bg-slab-900">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slab-400">
                  Service
                </th>
                {vehicleTypes.map((type) => (
                  <th
                    key={type.id}
                    className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap text-slab-400"
                  >
                    {type.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="md:divide-y-2 md:divide-slab-100">
              {washPriceRows.map((row) => (
                <tr key={row.id}>
                  {/*
                    `scope="row"` so a screen reader repeats the service name
                    with each price. `data-head` makes it the card's title
                    line on a phone — see `record-table` in globals.css.
                  */}
                  <th
                    scope="row"
                    className={`${cell} text-left font-bold`}
                    data-head=""
                  >
                    {row.name}
                  </th>
                  {vehicleTypes.map((type) => (
                    <td key={type.id} className={cell} data-label={type.name}>
                      <Price value={washPrice(priceBook, row.id, type.id)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/*
          Said once, plainly, where somebody looking at "Ask at the yard"
          will read it. Not an apology and not hidden in small print: three
          services genuinely have no published price yet, and the useful
          thing to hand over is the phone number.
        */}
        <p className="mt-3 max-w-prose text-sm text-slab-600">
          A few services are not on the list yet. We would rather leave them
          blank than print a price we cannot stand behind — ring{" "}
          <a
            href={telHref(business.phone)}
            className="font-bold underline underline-offset-4 hover:text-slab-900"
          >
            {business.phone}
          </a>{" "}
          or{" "}
          {/*
            The same number, offered the way most people here actually ask.
            One line only: this sentence is a hand-off, and a choice of four
            links is not a hand-off. Both lines are in the footer.
          */}
          <a
            href={whatsappHref(business.whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline underline-offset-4 hover:text-slab-900"
          >
            message us on WhatsApp
          </a>
          , and we will tell you what it costs.
        </p>
      </section>

      {/* --------------------- Flat-priced work --------------------- */}
      <section className="mt-10" aria-labelledby="prices-other">
        <h2 id="prices-other" className="text-xl">
          Everything else
        </h2>
        <p className="mt-1 max-w-prose text-sm text-slab-600">
          One price each, whatever the vehicle. These are not bookable online
          — bring them down or give us a ring.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {flatPriceGroups.map((group) => (
            <div
              key={group.id}
              className="rounded-slab border-2 border-slab-300 bg-white"
            >
              <h3 className="border-b-2 border-slab-200 bg-slab-50 px-4 py-2.5 text-base">
                {group.name}
              </h3>
              <dl className="divide-y-2 divide-slab-100">
                {group.rows.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                  >
                    <dt className="text-sm font-semibold">{row.name}</dt>
                    <dd className="text-sm">
                      <Price value={flatPrice(priceBook, row.id)} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-3 border-t-2 border-slab-200 pt-6">
        <ButtonLink href="/book" size="lg">
          Book a wash
        </ButtonLink>
        <ButtonLink href="/" variant="quiet" size="lg">
          Back home
        </ButtonLink>
      </div>
    </div>
  );
}
