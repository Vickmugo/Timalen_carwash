import Image from "next/image";
import { ImageCarousel, type CarouselSlide } from "@/components/ImageCarousel";
import { productPhotoAlt } from "@/data/products";
import type { Product } from "@/types";

/**
 * Product photography.
 *
 * Three states, decided by how many real photos exist for the item:
 *   2 or more  a slider — prev/next and an "n / total" counter
 *   exactly 1  a still image, no controls at all
 *   none       a labelled placeholder block at the right ratio
 *
 * The one-photo case is not the slider with its buttons hidden: road kerbs
 * have a single photograph and rendering paging chrome over it would
 * promise two more that do not exist. It also keeps that case on the server
 * — no client component, no carousel state, for an image that never moves.
 *
 * The slider itself is ImageCarousel, the same primitive the home page hero
 * runs on. Only the trigger differs: buttons here, a timer there.
 *
 * To add photos to a product: put the files in /public/images/products/ and
 * list them in `images` on that product in src/data/products.ts. This
 * component does not need to change.
 */

/**
 * One ratio, both frames.
 *
 * The detail frame used to widen to 16:10 above sm. Half of the real photos
 * are 3:4 portrait phone shots — a stack of slabs on end, a column of
 * spindles — and 16:10 threw away more than half their height, cropping to
 * a band across the middle of the stack. 4:3 is the shallowest frame these
 * originals survive, and it costs the landscape shots almost nothing.
 */
const ratios = {
  card: "aspect-4/3",
  detail: "aspect-4/3",
} as const;

/**
 * Real `sizes`, per frame, so a phone is not sent a desktop-width crop of a
 * 4-megapixel yard photo. The listing page and the detail page put these in
 * very different boxes, and both are capped by the max-w-5xl (64rem) page.
 */
const imageSizes = {
  // Three-up grid inside a 64rem page: ~20rem a card at the widest.
  card: "(min-width: 1024px) 20rem, (min-width: 640px) 50vw, 100vw",
  // Half the page from md up, full width below.
  detail: "(min-width: 768px) 32rem, 100vw",
} as const;

interface ProductGalleryProps {
  product: Product;
  variant?: keyof typeof ratios;
  /** The first photo on the detail page is that page's LCP element. */
  preload?: boolean;
}

/**
 * Alt text: authored where it exists, derived only as a fallback.
 *
 * `images` is a bare `string[]`, so the descriptions live beside the
 * catalogue in `productPhotoAlt` (src/data/products.ts), keyed by path.
 * That map is the real answer and covers every photo currently in the repo.
 *
 * The derived string below is what happens when someone adds a photo and
 * forgets the alt entry. It names the product and the slide position, which
 * is a GENERIC LABEL and is not good enough — it describes where the photo
 * sits in the set rather than what is in it. It is kept only so that a
 * missing entry degrades to something weak instead of rendering an empty
 * `alt` or crashing, and the fix for seeing it is always to write the real
 * line in products.ts rather than to improve this function.
 */
function altFor(product: Product, index: number, total: number): string {
  const authored = productPhotoAlt[product.images[index]];
  if (authored) return authored;

  const subject = `${product.name} in the yard at Timalen`;
  return total > 1 ? `${subject}, photo ${index + 1} of ${total}` : subject;
}

export function ProductGallery({
  product,
  variant = "card",
  preload = false,
}: ProductGalleryProps) {
  const frame = `w-full overflow-hidden rounded-slab ${ratios[variant]}`;
  const { images } = product;

  if (images.length === 0) {
    return (
      <div
        className={`${frame} hatch relative flex items-center justify-center border-2 border-slab-300`}
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

  if (images.length === 1) {
    return (
      <div className={`${frame} relative bg-slab-200`}>
        <Image
          src={images[0]}
          alt={altFor(product, 0, 1)}
          fill
          preload={preload}
          sizes={imageSizes[variant]}
          className="object-cover"
        />
      </div>
    );
  }

  const slides: CarouselSlide[] = images.map((src, index) => ({
    src,
    alt: altFor(product, index, images.length),
  }));

  return (
    <ImageCarousel
      slides={slides}
      label={`Photographs of ${product.name}`}
      controls="arrows"
      // No autoAdvanceMs: a catalogue this size with a slider on several of
      // its cards, all cycling by themselves, would be a page that will not
      // sit still while someone reads a price. These move when asked.
      frameClassName={ratios[variant]}
      crossfadeClassName="duration-200 ease-plain motion-reduce:transition-none"
      sizes={imageSizes[variant]}
      preloadFirst={preload}
      className="rounded-slab"
    />
  );
}
