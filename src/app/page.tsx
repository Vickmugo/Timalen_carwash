import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { PropertyCarousel } from "@/components/PropertyCarousel";
import { business, hoursSummary } from "@/data/business";
import { productCategories } from "@/data/products";
import { vehicleTypes, washPriceRows } from "@/data/services";
import { cheapestConfirmedPriceKes, washPrice } from "@/lib/prices";
import { getPriceBook } from "@/lib/prices-db";
import { formatKes } from "@/lib/format";

/**
 * Home.
 *
 * The two operations are deliberately NOT blended into a single pitch.
 * Someone arriving here wants one of two unrelated things, and the page
 * splits at the top rather than making them read a paragraph to find out
 * which door is theirs.
 *
 * THE HERO. For a roadside business with no brand, the proof that the place
 * is real is the place itself, so the photographs run full-bleed and carry
 * the page. The thing that makes that safe is that the two doors are ON the
 * photographs rather than under them: the hero can be as large as it likes
 * and "Book a Wash" does not move down by a single pixel, because it is
 * part of the same block. A bigger photo costs photograph, never reach.
 *
 * The buttons are also the only saturated colour above the fold. The
 * photographs are all cured grey, gravel and green hillside, so amber has
 * nothing to compete with — it reads as the one thing on the page asking
 * to be pressed.
 *
 * Only ImageCarousel inside PropertyCarousel is a client component;
 * everything here, the headline and both buttons included, is server-
 * rendered and passed through as children.
 */
/**
 * How many board rows the home page shows before sending people to /prices.
 * Three fits the width without the table needing to scroll on a phone-sized
 * card stack, and the summary is a taste rather than a substitute.
 */
const HOME_ROW_LIMIT = 3;

/**
 * Per request rather than prerendered — the summary table and the "from
 * KES" line both read live prices now. See the note on /prices.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const priceBook = await getPriceBook();
  const fromKes = cheapestConfirmedPriceKes(priceBook);

  /*
    Only rows priced in every column. A summary table with "ask at the yard"
    in it asks the visitor to do work on the home page; the full board, gaps
    and all, is one link away on /prices.
  */
  const homeRows = washPriceRows
    .filter((row) =>
      vehicleTypes.every(
        (type) => washPrice(priceBook, row.id, type.id) !== null,
      ),
    )
    .slice(0, HOME_ROW_LIMIT);

  return (
    <>
      {/* Hero — the yard itself, with both doors standing on it */}
      <section aria-labelledby="hero-heading">
        <PropertyCarousel>
          {/*
            Held to the same 64rem column as every other section so the
            headline starts on the page's left edge rather than drifting out
            to the far side of a wide monitor.
          */}
          <div className="mx-auto max-w-5xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-hivis">
              {business.location}
            </p>

            {/*
              `text-balance` earns its place here rather than being applied
              by habit: at this size the headline runs to two lines on a
              phone, and the natural break falls inside "one yard" — the
              half of the line that carries the meaning. Balanced, it breaks
              at the comma instead. Every line of text here is also scrim,
              and scrim is photograph covered up, which is why the sentence
              is four words long.
            */}
            <h1
              id="hero-heading"
              className="mt-1.5 text-balance text-3xl text-slab-50 sm:text-5xl lg:text-6xl"
            >
              Two trades, one yard
            </h1>

            <p className="mt-3 hidden max-w-md text-sm text-slab-200 sm:block sm:text-base">
              A wash bay and a concrete works on the same premise. Pick the one
              you came for.
            </p>

            {/*
              Stacked on a phone, side by side from sm. Full-width thumb
              targets beat two half-width buttons with a label wrapping to
              three lines — this is the whole job of the page and it should
              not require aim.
            */}
            <div className="mt-4 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:gap-3">
              <Link
                href="/book"
                className="lift flex min-h-12 flex-1 items-center gap-3 rounded-slab border-2 border-hivis bg-hivis px-4 py-2.5 text-slab-900 hover:border-hivis-dark hover:bg-hivis-dark sm:flex-none sm:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-base leading-tight font-extrabold uppercase tracking-tight sm:text-lg">
                    Book a Wash
                  </span>
                  {/*
                    The lowest confirmed cell on the price board, computed
                    rather than typed — see cheapestConfirmedPriceKes. The
                    whole "From ..." clause drops out if the board somehow
                    has no confirmed price, rather than advertising KES 0.
                  */}
                  <span className="mt-0.5 block text-xs text-slab-800 sm:text-sm">
                    {fromKes !== null ? `From ${formatKes(fromKes)}. ` : null}
                    One bay, your slot.
                  </span>
                </span>
                <span aria-hidden="true" className="lift-nudge shrink-0 text-xl">
                  &rarr;
                </span>
              </Link>

              <Link
                href="/products"
                className="lift flex min-h-12 flex-1 items-center gap-3 rounded-slab border-2 border-slab-500 bg-slab-800 px-4 py-2.5 text-slab-100 hover:border-hivis sm:flex-none sm:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-base leading-tight font-extrabold uppercase tracking-tight sm:text-lg">
                    Browse Concrete Products
                  </span>
                  <span className="mt-0.5 block text-xs text-slab-300 sm:text-sm">
                    Posts, slabs, spindles, caps and kerbs.
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="lift-nudge shrink-0 text-xl text-hivis"
                >
                  &rarr;
                </span>
              </Link>
            </div>
          </div>
        </PropertyCarousel>
      </section>

      {/* Wash summary */}
      <section className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl sm:text-2xl">At the wash bay</h2>
          <Link
            href="/prices"
            className="text-sm font-bold uppercase tracking-wide text-slab-600 underline underline-offset-4 hover:text-slab-900"
          >
            All prices
          </Link>
        </div>

        {/*
          A TASTE OF THE BOARD, NOT A COPY OF IT.

          Three services the yard actually sells, priced across the three
          vehicle columns, straight from src/data/services.ts. This used to
          be three invented tiers at guessed prices under names nobody at
          the yard would recognise.

          Only rows with a confirmed price in EVERY column appear, so the
          home page never shows "ask at the yard" in a summary that is
          meant to be scanned in two seconds — /prices carries the full
          board, gaps included, and the link above goes straight to it.
        */}
        <div className="mt-4 rounded-slab border-2 border-slab-200 bg-white p-3 md:overflow-x-auto md:p-0">
          <table className="record-table w-full border-collapse md:min-w-[30rem]">
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
              {homeRows.map((row) => (
                <tr key={row.id}>
                  <th
                    scope="row"
                    className="px-3 py-2.5 text-left text-sm font-bold"
                    data-head=""
                  >
                    {row.name}
                  </th>
                  {vehicleTypes.map((type) => (
                    <td
                      key={type.id}
                      className="px-3 py-2.5 text-sm font-bold"
                      data-label={type.name}
                    >
                      {formatKes(washPrice(priceBook, row.id, type.id) as number)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Product summary */}
      <section className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl sm:text-2xl">From the concrete yard</h2>
          <Link
            href="/products"
            className="text-sm font-bold uppercase tracking-wide text-slab-600 underline underline-offset-4 hover:text-slab-900"
          >
            All products
          </Link>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {productCategories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/products?category=${category.id}`}
                className="lift flex h-full flex-col rounded-slab border-2 border-slab-200 bg-white p-4 hover:border-slab-900"
              >
                <h3 className="text-base">{category.name}</h3>
                <p className="mt-2 text-sm text-slab-600">{category.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Practical strip */}
      <section className="mx-auto max-w-5xl px-4 pb-10">
        <div className="grid gap-6 rounded-slab border-2 border-slab-200 bg-white p-6 sm:grid-cols-3">
          <div>
            <h2 className="text-sm text-slab-500">Opening hours</h2>
            <p className="mt-1 font-bold">{hoursSummary}</p>
          </div>
          <div>
            <h2 className="text-sm text-slab-500">Find us</h2>
            <p className="mt-1 font-bold">{business.location}</p>
          </div>
          <div>
            <h2 className="text-sm text-slab-500">Big or custom order?</h2>
            <ButtonLink href="/quote" variant="outline" size="sm" className="mt-2">
              Request a quote
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
