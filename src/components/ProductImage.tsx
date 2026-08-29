import Image from "next/image";
import type { Product } from "@/types";

/**
 * Product imagery.
 *
 * Real photos do not exist in the repo yet, so this renders a labelled
 * placeholder block at the correct aspect ratio — no external stock photo,
 * no broken-image icon, no layout shift when the real file lands.
 *
 * To swap in a real photo:
 *   1. put the file in /public/images/products/
 *   2. set `image` on that product in src/data/products.ts
 * This component does not need to change.
 */

const ratios = {
  card: "aspect-4/3",
  detail: "aspect-4/3 sm:aspect-16/10",
} as const;

interface ProductImageProps {
  product: Product;
  variant?: keyof typeof ratios;
  priority?: boolean;
}

export function ProductImage({
  product,
  variant = "card",
  priority = false,
}: ProductImageProps) {
  const shape = `relative w-full overflow-hidden rounded-slab ${ratios[variant]}`;

  if (product.image) {
    return (
      <div className={`${shape} bg-slab-200`}>
        <Image
          src={product.image}
          alt={product.name}
          fill
          priority={priority}
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${shape} hatch flex items-center justify-center border-2 border-slab-300`}
      role="img"
      aria-label={`Photo of ${product.name} not added yet`}
    >
      <span className="mx-3 rounded-slab bg-slab-900/85 px-2.5 py-1.5 text-center font-mono text-[11px] leading-tight text-slab-100">
        images/products/
        <wbr />
        {product.slug}.jpg
      </span>
    </div>
  );
}
