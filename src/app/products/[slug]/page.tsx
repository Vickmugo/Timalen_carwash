import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FulfilmentBadge } from "@/components/Badge";
import { ButtonLink } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { ProductGallery } from "@/components/ProductGallery";
import { quoteRules } from "@/data/config";
import { getProduct, variantNoun } from "@/data/products";
import { formatKes } from "@/lib/format";
import { productPrice, productPriceRange, variantPrices } from "@/lib/prices";
import { getPriceBook } from "@/lib/prices-db";
import { AddToCart, VariantAddToCart } from "./AddToCart";

/**
 * NO `generateStaticParams` ANY MORE, and the page is explicitly dynamic.
 *
 * These pages used to be prerendered at build time, which was right
 * while a product's price was a compiled constant. It is a row now, edited
 * from the staff view, and a prerendered product page is a page showing a
 * price the checkout will not honour. Static generation and live editing
 * are mutually exclusive here; the brief asked for live editing.
 *
 * Unknown slugs behave exactly as before — `getProduct` returns undefined
 * and the page calls `notFound()`.
 */
export const dynamic = "force-dynamic";

/**
 * Per-product metadata.
 *
 * Description is the product's own copy plus its fulfilment state, which is
 * the question a buyer actually has ("can I collect it today, or is it cast
 * to order?"). Both come from src/data/products.ts, so a change there
 * carries into search results without a second edit.
 *
 * NO PRICE AND NO DIMENSIONS, for the reason stated at the top of
 * src/data/products.ts: the photographs are real and every number beside
 * them is still a guess. A description is quoted verbatim by search
 * engines, so putting a placeholder price in one publishes it. The specs
 * table on the page carries the same warning in a comment; this is the same
 * rule applied to the part of the page that leaves the site.
 *
 * No `product:price` OpenGraph tags either, and no Product JSON-LD — both
 * exist to feed shopping results, and neither should be fed invented
 * figures. They are the obvious next addition once the client confirms
 * pricing.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};

  const availability =
    product.status === "ready_to_ship"
      ? "Normally in the yard and ready to collect."
      : "Cast to order.";

  const description = `${product.description} ${availability}`;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url: `/products/${product.slug}`,
      // The product's own first photograph, resolved against metadataBase.
      // Products with no photo fall back to the site default rather than
      // linking a file that is not there.
      ...(product.images.length > 0 ? { images: [product.images[0]] } : {}),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const priceBook = await getPriceBook();
  // A product sold by height has no single figure; `productPrice` without a
  // variant is null for it by construction. `unpriced` is therefore asked
  // of the range, which covers both shapes: null only when NOTHING about
  // the product has a confirmed price.
  const priceKes = productPrice(priceBook, product.id);
  const unpriced = productPriceRange(priceBook, product) === null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/*
        The eyebrow and the back link both used to carry the category name.
        Now that a category holds exactly one entry, its name and the
        product's name are the same word, and the page opened saying
        "Spindles" three times over — back link, eyebrow, heading. The
        eyebrow says which half of the business this is instead, and the
        back link goes to the whole catalogue rather than to a filtered view
        containing only the item just navigated away from.
      */}
      <PageHeader
        eyebrow="Concrete yard"
        title={product.name}
        backHref="/products"
        backLabel="Products"
      />

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div>
          <ProductGallery product={product} variant="detail" preload />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <FulfilmentBadge status={product.status} />
            {product.status === "made_to_order" ? (
              <span className="text-sm text-slab-600">
                Cast on order, not held in the yard.
              </span>
            ) : null}
          </div>

          <p className="mt-4 text-slab-700">{product.description}</p>

          {/*
            TWO WAYS TO HAVE NO PRICE, AND THEY ARE NOT THE SAME THING.

            `quoteOnly` means the item is priced per job by design — bespoke
            work that genuinely has no list price. A null in the price book
            means nobody has confirmed a figure for a product that ought to
            have one. Both end up here, because in both cases the honest
            answer is "ask us", and neither may be put in a basket. The
            wording distinguishes them: telling a customer their fencing
            post is bespoke would be false.
          */}
          {product.quoteOnly || unpriced ? (
            <div className="mt-6 rounded-slab border-2 border-hivis bg-hivis-tint p-4">
              <h2 className="text-base">
                {product.quoteOnly
                  ? "Priced by quote"
                  : "Price not listed — ask at the yard"}
              </h2>
              <p className="mt-2 text-sm text-slab-800">
                {product.quoteOnly
                  ? "This one is made to your pattern and measurements, so there is no list price. Send us the details and we will come back with a figure."
                  : "We have not published a price for this item yet. Send us the details, or ring the yard, and we will tell you what it costs."}
              </p>
              <ButtonLink
                href={`/quote?product=${product.slug}`}
                size="lg"
                fullWidth
                className="mt-4"
              >
                Request a quote
              </ButtonLink>
            </div>
          ) : (
            <>
              {/*
                SOLD BY HEIGHT: the headline price, the height picker and the
                basket controls are one client component, because the price
                moves with the selection. Everything around it — badge,
                description, bulk-quote link, spec table — is unchanged.
              */}
              {product.variants ? (
                <VariantAddToCart
                  product={product}
                  variants={variantPrices(priceBook, product)}
                />
              ) : priceKes !== null ? (
                <>
                  <div className="mt-6 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold">
                      {formatKes(priceKes)}
                    </span>
                    <span className="text-sm text-slab-500">
                      {product.unitLabel}
                    </span>
                  </div>
                  <AddToCart product={product} choice={{ priceKes }} />
                </>
              ) : null}
              {/*
                NO LONGER A PLACEHOLDER ON EVERY LINE. Slab, wall caps,
                channels, cornices, cabros, and every height of fencing posts
                and spindles carry figures the client confirmed; road kerbs
                is still a guess. Which is which is recorded in the header
                note in src/data/products.ts rather than asserted here,
                because the answer changes as the client confirms more of
                them and a blanket warning in the markup would go stale
                silently.
              */}

              <p className="mt-4 text-sm text-slab-600">
                Need more than {quoteRules.maxUnitsPerLine}
                {product.variants ? ` of one ${variantNoun(product)}` : ""}?{" "}
                <Link
                  href={`/quote?product=${product.slug}`}
                  className="font-semibold underline underline-offset-4 hover:text-slab-900"
                >
                  Ask for a bulk quote
                </Link>{" "}
                instead — we will confirm production time. Collect from the yard.
              </p>
            </>
          )}

          {/*
            NO TABLE AT ALL WHEN THERE IS NOTHING TRUE TO PUT IN IT.

            Channels, cornices and cabros carry `specs: []` — not one
            dimension has been given for any of them, and the rule in
            src/data/products.ts is that an unconfirmed figure does not get
            invented to fill a row. Rendered unguarded, an empty array gives
            a "Specification" heading over an empty bordered box, which
            reads as a page that failed to load rather than as a table that
            was deliberately left out.

            The sentence that replaces it says which of the two it is, and
            points at the quote form, because "what size do they come in"
            is precisely the question someone reaching this part of the page
            is asking.
          */}
          {product.specs.length > 0 ? (
            <>
              <h2 className="mt-8 text-base">Specification</h2>
              <dl className="mt-3 divide-y-2 divide-slab-100 rounded-slab border-2 border-slab-200 bg-white">
                {product.specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="flex flex-wrap justify-between gap-2 px-4 py-2.5"
                  >
                    <dt className="text-sm font-bold uppercase tracking-wide text-slab-500">
                      {spec.label}
                    </dt>
                    <dd className="text-sm font-semibold">{spec.value}</dd>
                  </div>
                ))}
              </dl>
              {/*
                PLACEHOLDER DIMENSIONS. Every value in this table is a guess
                and is marked as such in src/data/products.ts. The
                photographs above are real; these numbers are not, and the
                two sitting side by side is exactly why they are still
                flagged.
              */}
            </>
          ) : (
            <p className="mt-8 rounded-slab border-2 border-slab-200 bg-slab-50 px-4 py-3 text-sm text-slab-600">
              We have not published sizes for this one yet.{" "}
              <Link
                href={`/quote?product=${product.slug}`}
                className="font-semibold underline underline-offset-4 hover:text-slab-900"
              >
                Ask us
              </Link>{" "}
              and we will tell you what is currently cast.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
