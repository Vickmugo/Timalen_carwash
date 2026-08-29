import Link from "next/link";
import { notFound } from "next/navigation";
import { FulfilmentBadge } from "@/components/Badge";
import { ButtonLink } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { ProductImage } from "@/components/ProductImage";
import { quoteRules } from "@/data/config";
import { getCategory, getProduct, products } from "@/data/products";
import { formatKes } from "@/lib/format";
import { AddToCart } from "./AddToCart";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const category = getCategory(product.categoryId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        eyebrow={category?.name}
        title={product.name}
        backHref={`/products?category=${product.categoryId}`}
        backLabel={category?.name ?? "Products"}
      />

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div>
          <ProductImage product={product} variant="detail" priority />
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

          {product.quoteOnly ? (
            <div className="mt-6 rounded-slab border-2 border-hivis bg-hivis-tint p-4">
              <h2 className="text-base">Priced by quote</h2>
              <p className="mt-2 text-sm text-slab-800">
                This one is made to your pattern and measurements, so there is
                no list price. Send us the details and we will come back with a
                figure.
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
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold">
                  {formatKes(product.priceKes)}
                </span>
                <span className="text-sm text-slab-500">
                  {product.unitLabel}
                </span>
              </div>
              {/* PLACEHOLDER PRICE - see src/data/products.ts */}

              <AddToCart product={product} />

              <p className="mt-4 text-sm text-slab-600">
                Need more than {quoteRules.maxUnitsPerLine}?{" "}
                <Link
                  href={`/quote?product=${product.slug}`}
                  className="font-semibold underline underline-offset-4 hover:text-slab-900"
                >
                  Ask for a bulk quote
                </Link>{" "}
                instead — we will confirm production time and delivery.
              </p>
            </>
          )}

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
          {/* TODO: confirm every specification value with the client. */}
        </div>
      </div>
    </div>
  );
}
