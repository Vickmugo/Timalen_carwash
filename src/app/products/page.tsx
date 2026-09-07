import type { Metadata } from "next";
import Link from "next/link";
import { FulfilmentBadge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { ProductGallery } from "@/components/ProductGallery";
import { quoteRules } from "@/data/config";
import {
  getCategory,
  getProductsByCategory,
  productCategories,
  products,
} from "@/data/products";
import type { PriceCell, Product, ProductCategoryId } from "@/types";
import { productPrice } from "@/lib/prices";
import { getPriceBook } from "@/lib/prices-db";
import { formatKes } from "@/lib/format";

/**
 * Names the five lines the yard actually casts, because those are the words
 * someone types — "fencing posts", "road kerbs" — not "concrete products".
 * The cabros/air vents/culverts line is left out on purpose: they are not
 * listed on this page yet (see the note at the bottom of the grid), and a
 * description promising products the page does not show is the kind of
 * result a visitor bounces straight off.
 */
export const metadata: Metadata = {
  title: "Concrete products",
  description:
    "Fencing posts, slabs, spindles, column and pillar caps, and road kerbs — cast in our own yard and sold off the stack. Buy standard items online or ask for a bulk quote.",
  alternates: { canonical: "/products" },
  openGraph: {
    title: "Concrete products",
    description:
      "Fencing posts, slabs, spindles, column caps and road kerbs, cast in our own yard.",
    url: "/products",
  },
};

function isCategoryId(value: string): value is ProductCategoryId {
  return productCategories.some((category) => category.id === value);
}

/**
 * The catalogue.
 *
 * One flat grid, not a run of per-category sections. Each category holds
 * exactly one entry — the yard sells product LINES, not variants — so
 * sections would mean five headings above five single cards, which is a
 * page made mostly of its own scaffolding. The category names still exist
 * as the filter above; picking one narrows the grid and brings its
 * description with it.
 */
/**
 * Per request. Prices are rows now, not constants — see the note on
 * /prices.
 */
export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const activeCategory = category && isCategoryId(category) ? category : null;

  const priceBook = await getPriceBook();

  const shown = activeCategory ? getProductsByCategory(activeCategory) : products;
  const activeDetail = activeCategory ? getCategory(activeCategory) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        eyebrow="Concrete yard"
        title="Concrete Products"
        backHref="/"
        backLabel="Home"
        intro={
          <p>
            Cast in our own yard and sold off the stack. Standard items can be
            bought straight from this page; bulk orders over{" "}
            {quoteRules.maxUnitsPerLine} units, and anything custom, go through
            a quote instead.
          </p>
        }
      />

      {/* Category filter */}
      <nav aria-label="Product categories" className="mt-6">
        <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <li>
            <Link
              href="/products"
              aria-current={activeCategory ? undefined : "page"}
              className={`flex min-h-11 items-center whitespace-nowrap rounded-slab border-2 px-4 text-sm font-bold uppercase tracking-wide transition-colors duration-150 ease-plain ${
                activeCategory
                  ? "border-slab-200 bg-white text-slab-600 hover:border-slab-500"
                  : "border-slab-900 bg-slab-900 text-slab-50"
              }`}
            >
              All
            </Link>
          </li>
          {productCategories.map((entry) => {
            const active = activeCategory === entry.id;
            return (
              <li key={entry.id}>
                <Link
                  href={`/products?category=${entry.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center whitespace-nowrap rounded-slab border-2 px-4 text-sm font-bold uppercase tracking-wide transition-colors duration-150 ease-plain ${
                    active
                      ? "border-slab-900 bg-slab-900 text-slab-50"
                      : "border-slab-200 bg-white text-slab-600 hover:border-slab-500"
                  }`}
                >
                  {entry.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {activeDetail ? (
        <div className="mt-8">
          <h2 className="text-xl sm:text-2xl">{activeDetail.name}</h2>
          <p className="mt-1 max-w-prose text-sm text-slab-600">
            {activeDetail.blurb}
          </p>
        </div>
      ) : null}

      <ul
        className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${
          activeDetail ? "mt-4" : "mt-8"
        }`}
      >
        {shown.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            priceKes={productPrice(priceBook, product.id)}
          />
        ))}
      </ul>

      {/*
        The wall at the yard advertises more than this — cabros, air vents,
        culverts, cornices. They are not listed because there is no photo and
        no price for any of them yet, and a card with an empty image frame
        next to real photography reads as broken rather than as forthcoming.
        Said once, in words, at the bottom of the grid. See the note at the
        top of src/data/products.ts.
      */}
      <p className="mt-8 max-w-prose border-t-2 border-slab-200 pt-6 text-sm text-slab-600">
        The yard also casts cabros, air vents, culverts and cornices. They are
        not listed here yet.{" "}
        <Link
          href="/quote"
          className="font-semibold underline underline-offset-4 hover:text-slab-900"
        >
          Ask for a quote
        </Link>{" "}
        and we will confirm what is available and what it costs.
      </p>
    </div>
  );
}

/**
 * A product card.
 *
 * The whole card is one click target, but it is NOT wrapped in a link: the
 * photo slider's prev/next buttons live inside it, and a button inside an
 * anchor is invalid markup that behaves differently in every browser.
 * Instead the product name is the real link and its `::after` is stretched
 * over the card at z-10 — above the photos, so the picture is clickable,
 * and below the slider controls at z-20, so paging through the photos does
 * not fire a navigation. One link in the tab order, one accessible name.
 */
function ProductCard({
  product,
  priceKes,
}: {
  product: Product;
  priceKes: PriceCell;
}) {
  return (
    <li className="lift relative flex h-full flex-col rounded-slab border-2 border-slab-200 bg-white p-3 hover:border-slab-900">
      <ProductGallery product={product} />

      <div className="mt-3 flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base leading-tight">
            <Link
              href={`/products/${product.slug}`}
              className="after:absolute after:inset-0 after:z-10 after:content-['']"
            >
              {product.name}
            </Link>
          </h3>
          <FulfilmentBadge status={product.status} />
        </div>

        <p className="mt-2 flex-1 text-sm text-slab-600">
          {product.description}
        </p>

        <div className="mt-3 border-t-2 border-slab-100 pt-3">
          {/*
            "Priced by quote" and "price not listed" are different claims —
            one is how the item is sold, the other is a gap on our side. See
            the fuller note on the product page.
          */}
          {product.quoteOnly ? (
            <span className="text-sm font-bold uppercase tracking-wide text-hivis-dark">
              Priced by quote
            </span>
          ) : priceKes === null ? (
            <span className="text-sm font-semibold text-slab-500">
              Price not listed — ask at the yard
            </span>
          ) : (
            <span className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold">
                {formatKes(priceKes)}
              </span>
              <span className="text-xs text-slab-500">{product.unitLabel}</span>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
