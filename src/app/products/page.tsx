import Link from "next/link";
import { FulfilmentBadge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { ProductImage } from "@/components/ProductImage";
import { quoteRules } from "@/data/config";
import {
  getProductsByCategory,
  productCategories,
} from "@/data/products";
import type { ProductCategoryId } from "@/types";
import { formatKes } from "@/lib/format";

export const metadata = {
  title: "Concrete products",
};

function isCategoryId(value: string): value is ProductCategoryId {
  return productCategories.some((category) => category.id === value);
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const activeCategory = category && isCategoryId(category) ? category : null;

  const shownCategories = activeCategory
    ? productCategories.filter((entry) => entry.id === activeCategory)
    : productCategories;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        eyebrow="Concrete yard"
        title="Concrete Products"
        backHref="/"
        backLabel="Home"
        intro={
          <p>
            Standard items can be bought straight from this page. Bulk orders
            over {quoteRules.maxUnitsPerLine} units, and anything custom, go
            through a quote instead.
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
              className={`flex min-h-11 items-center whitespace-nowrap rounded-slab border-2 px-4 text-sm font-bold uppercase tracking-wide transition-colors duration-150 ease-out ${
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
                  className={`flex min-h-11 items-center whitespace-nowrap rounded-slab border-2 px-4 text-sm font-bold uppercase tracking-wide transition-colors duration-150 ease-out ${
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

      {shownCategories.map((entry) => {
        const items = getProductsByCategory(entry.id);
        return (
          <section key={entry.id} className="mt-10">
            <h2 className="text-xl">{entry.name}</h2>
            <p className="mt-1 max-w-2xl text-sm text-slab-600">{entry.blurb}</p>

            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/products/${product.slug}`}
                    className="group flex h-full flex-col rounded-slab border-2 border-slab-200 bg-white p-3 transition-colors duration-150 ease-out hover:border-slab-900"
                  >
                    <ProductImage product={product} />

                    <div className="mt-3 flex flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base leading-tight">
                          {product.name}
                        </h3>
                        <FulfilmentBadge status={product.status} />
                      </div>

                      <p className="mt-2 flex-1 text-sm text-slab-600">
                        {product.description}
                      </p>

                      <div className="mt-3 border-t-2 border-slab-100 pt-3">
                        {product.quoteOnly ? (
                          <span className="text-sm font-bold uppercase tracking-wide text-hivis-dark">
                            Priced by quote
                          </span>
                        ) : (
                          <span className="flex items-baseline gap-1.5">
                            <span className="text-lg font-extrabold">
                              {formatKes(product.priceKes)}
                            </span>
                            <span className="text-xs text-slab-500">
                              {product.unitLabel}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
