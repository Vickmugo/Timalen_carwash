/**
 * CONCRETE PRODUCTS
 *
 * Rebuilt around what the yard actually casts and what there are real
 * photographs of. Five lines, one entry each — these are product lines, not
 * SKUs, which is how the yard itself talks about them ("posts", "spindles").
 * Each line is both a category (for the filter nav and the breadcrumb) and
 * the single sellable entry underneath it.
 *
 * ---------------------------------------------------------------------
 * THE PHOTOS ARE REAL. THE NUMBERS ARE NOT.
 * ---------------------------------------------------------------------
 * Every dimension in `specs` and every lead time below is still the same
 * placeholder guess it was before the photography landed. Real photographs
 * sitting next to invented figures is exactly the trap: the page now looks
 * confirmed, and it is not. Nothing here may be quoted to a customer until
 * the client has been asked.
 *
 * Each guessed value is marked inline. Do not remove a marker without
 * having actually confirmed that value.
 *
 * PRICES ARE NO LONGER IN THIS FILE. They moved to `product_prices` in the
 * database so the yard can correct them from the staff view without a
 * deploy — see supabase/migrations/20260907150000_price_tables.sql. The
 * figures seeded there are the SAME five placeholders that used to sit
 * here, and moving them has not made any of them true. What changed is
 * only that fixing one no longer needs a developer.
 * ---------------------------------------------------------------------
 *
 * NOT YET LISTED — pending real content.
 * The hand-painted wall at the yard (see property-signage-supplies.jpg)
 * also advertises CABROS, AIR VENTS, CULVERTS and CORNICES. They are
 * deliberately absent from this file: there is no photograph of any of
 * them and no price. They get an entry when a real photo and a real price
 * exist for each — not before. A "coming soon" card with an empty image
 * frame, sitting in a grid beside real photography, reads as a broken
 * catalogue rather than an honest one.
 *
 * `status` is set BY HAND. There is no stock count anywhere in this app and
 * there should not be one — this business does not keep reliable counts.
 *   "ready_to_ship"  = normally sitting in the yard, can be collected
 *   "made_to_order"  = cast on demand, has a lead time
 */

import type { Product, ProductCategory, ProductCategoryId } from "@/types";

/**
 * The spindle mould, opened mid-cast.
 *
 * Held back from `products` on purpose. It is a photograph of the PROCESS —
 * green steel moulds standing open on the ground with the cast still setting
 * inside them — not of a thing anyone can buy. Dropped into the spindle
 * slider next to three finished stacks it would read as "this is what
 * arrives".
 *
 * It is a good photograph and it belongs somewhere: a "how it is made"
 * strip, or an about page. Currently rendered nowhere.
 */
export const spindleMouldPhoto = {
  src: "/images/products/product-spindle-04-mould-inprogress.jpg",
  alt: "Green steel spindle moulds standing open on the ground at the yard, each holding a freshly cast baluster still setting inside it.",
} as const;

/**
 * ALT TEXT FOR THE PRODUCT PHOTOGRAPHS, keyed by path.
 *
 * WHY A SEPARATE MAP RATHER THAN A FIELD ON `Product`.
 * `Product.images` is a `string[]`, and the catalogue's shape is not being
 * changed in this pass. A lookup keyed by the file path adds the missing
 * text without touching the `Product` type, the `products` array, or
 * anything that reads them.
 *
 * WHAT THIS REPLACES. ProductGallery used to DERIVE alt from the product
 * name and the slide number — "Fencing Posts in the yard at Timalen, photo
 * 2 of 3". That is a generic label: it names the product a sighted visitor
 * can already see named directly above the photo, and then tells them a
 * position rather than a subject. Someone on a screen reader, or on a
 * connection that dropped the image, learned nothing about what the picture
 * actually showed — and these photos differ a lot from each other. One
 * shows posts stacked with kerbs and caps behind them; the next is the same
 * product laid out to cure with the drill holes visible. That difference is
 * the reason there are three photos instead of one.
 *
 * WRITING A NEW ONE. Describe the SUBJECT and what is genuinely visible,
 * the way src/data/property.ts does. Do not start with "Photo of" or
 * "Image of" — a screen reader already says "image". Do not repeat the
 * product name if the sentence works without it. Do not describe the
 * measurements: the numbers in `specs` below are still placeholders, and
 * alt text is the wrong place to assert a size.
 *
 * A path with no entry here falls back to the derived label in
 * ProductGallery, so adding a photo without alt text degrades rather than
 * breaking. Add the entry.
 */
export const productPhotoAlt: Record<string, string> = {
  "/images/products/product-fencepost-01.jpg":
    "A fan of ridged concrete posts laid flat across the gravel yard, with stacks of road kerbs, slabs on edge and pillar caps lined up along the boundary wall behind them.",
  "/images/products/product-fencepost-02.jpg":
    "Seven square-section posts laid out parallel on the ground to cure, tie wire offcuts to one side and the steel casting moulds still lying alongside them.",
  "/images/products/product-fencepost-03.jpg":
    "A row of posts laid side by side with grass growing up between them, the line of pre-drilled fencing-wire holes running down the face of each one.",

  "/images/products/product-slab-02.jpg":
    "Rows of flat grey slabs stood on edge and leaning against a whitewashed wall, packed close together with the rough cast edges facing out.",
  "/images/products/product-slab-03.jpg":
    "Slabs stacked on edge in the sun against a rendered wall, the nearest one turned to show its full face and the pitted texture of the cast surface.",

  "/images/products/product-spindle-01.jpg":
    "Rows of turned balusters stacked several courses high on the grass, each with a square cap and a steel fixing pin standing out of the top, while a worker sets out more of them on the gravel behind.",
  "/images/products/product-spindle-02.jpg":
    "Balusters standing in tight blocks on the grass and gravel, seen from above so the square caps and their centre fixing pins fill most of the frame.",
  "/images/products/product-spindle-03.jpg":
    "A close row of balusters standing upright on the grass, the bellied profile of each one clearly visible, with a motorbike and the yard's iron-sheet fence behind.",

  "/images/products/product-columncap-01.jpg":
    "Square pillar caps stacked against a wall, each with a shallow pyramid top, the four cast ridges running to the corners and a centre hole for a light or finial.",
  "/images/products/product-columncap-02.jpg":
    "Pillar caps stacked on edge in a long row beside a whitewashed wall, with two finished caps laid flat in the foreground showing the pyramid face and the centre hole.",

  "/images/products/product-roadkerb-01.jpg":
    "Heavy chamfered road kerbs laid out in rows on the grass, the angled top edge running the length of each one and further rows stacked behind.",
};

export const productCategories: ProductCategory[] = [
  {
    id: "fencing-posts",
    name: "Fencing Posts",
    blurb:
      "Cast and reinforced posts, pre-drilled for chain-link and barbed wire.",
  },
  {
    id: "slabs",
    name: "Slabs",
    blurb: "Flat cast slabs for paths, drain covers and standing bases.",
  },
  {
    id: "spindles",
    name: "Spindles",
    blurb:
      "Turned balusters for balcony and staircase railings, cast in our own moulds.",
  },
  {
    id: "column-caps",
    name: "Column & Pillar Caps",
    blurb:
      "Pyramid-topped caps that finish a gate pillar and throw rain off the column head.",
  },
  {
    id: "road-kerbs",
    name: "Road Kerbs",
    blurb: "Heavy edging kerbs for roadsides, driveways and parking bays.",
  },
];

export const products: Product[] = [
  /* -------------------------- Fencing Posts ------------------------- */
  {
    id: "fencing-post",
    slug: "fencing-posts",
    categoryId: "fencing-posts",
    name: "Fencing Posts",
    description:
      "Reinforced concrete posts cast on site and pre-drilled for the fencing wire. Cured in the open yard and sold straight off the stack.",
    unitLabel: "per piece",
    status: "ready_to_ship",
    quoteOnly: false,
    specs: [
      { label: "Height", value: "8 ft (approx. 2.4 m)" }, // PLACEHOLDER DIMENSION
      { label: "Section", value: "100 x 100 mm" }, // PLACEHOLDER DIMENSION
      { label: "Reinforcement", value: "4 bar, tied" }, // PLACEHOLDER SPEC
      { label: "Holes", value: "Pre-drilled, 5 lines" }, // PLACEHOLDER SPEC
    ],
    images: [
      "/images/products/product-fencepost-01.jpg",
      "/images/products/product-fencepost-02.jpg",
      "/images/products/product-fencepost-03.jpg",
    ],
  },

  /* ------------------------------ Slabs ----------------------------- */
  {
    id: "slab",
    slug: "slabs",
    categoryId: "slabs",
    name: "Slabs",
    description:
      "Flat rectangular slabs for footpaths, drain and channel covers, and standing bases for tanks. Stacked on edge in the yard.",
    unitLabel: "per piece",
    status: "ready_to_ship",
    quoteOnly: false,
    specs: [
      { label: "Size", value: "600 x 400 mm" }, // PLACEHOLDER DIMENSION
      { label: "Thickness", value: "50 mm" }, // PLACEHOLDER DIMENSION
      { label: "Finish", value: "Grey, natural cement" },
      { label: "Typical use", value: "Paths, drain covers, tank bases" },
    ],
    images: [
      "/images/products/product-slab-02.jpg",
      "/images/products/product-slab-03.jpg",
    ],
  },

  /* ---------------------------- Spindles ---------------------------- */
  {
    id: "spindle",
    slug: "spindles",
    categoryId: "spindles",
    name: "Spindles",
    description:
      "Turned balusters for balcony and staircase railings, cast in the yard's own moulds and left to cure on the grass. Each one comes with the fixing pin already set into the cap.",
    unitLabel: "per piece",
    status: "ready_to_ship",
    quoteOnly: false,
    specs: [
      { label: "Height", value: "500 mm" }, // PLACEHOLDER DIMENSION
      { label: "Cap", value: "Square, 150 x 150 mm" }, // PLACEHOLDER DIMENSION
      { label: "Fixing", value: "Steel pin cast into the cap" },
      { label: "Lead time", value: "3 - 5 days if cast to order" }, // PLACEHOLDER LEAD TIME
    ],
    images: [
      "/images/products/product-spindle-01.jpg",
      "/images/products/product-spindle-02.jpg",
      "/images/products/product-spindle-03.jpg",
      // product-spindle-04-mould-inprogress.jpg is NOT in this list.
      // See `spindleMouldPhoto` above — it is a process shot, not a product.
    ],
  },

  /* --------------------- Column & Pillar Caps ----------------------- */
  {
    id: "column-cap",
    slug: "column-caps",
    categoryId: "column-caps",
    name: "Column & Pillar Caps",
    description:
      "Square caps with a shallow pyramid top, cast with a centre hole for a light or a finial. They finish a gate pillar and shed rain off the column head.",
    unitLabel: "per piece",
    status: "ready_to_ship",
    quoteOnly: false,
    specs: [
      { label: "Size", value: "400 x 400 mm" }, // PLACEHOLDER DIMENSION
      { label: "Profile", value: "Pyramid top, square base" },
      { label: "Centre hole", value: "Cast in, approx. 25 mm" }, // PLACEHOLDER DIMENSION
      { label: "Lead time", value: "3 - 5 days if cast to order" }, // PLACEHOLDER LEAD TIME
    ],
    images: [
      "/images/products/product-columncap-01.jpg",
      "/images/products/product-columncap-02.jpg",
    ],
  },

  /* --------------------------- Road Kerbs --------------------------- */
  {
    id: "road-kerb",
    slug: "road-kerbs",
    categoryId: "road-kerbs",
    name: "Road Kerbs",
    description:
      "Heavy chamfered kerbs for roadsides, driveway edges and parking bays. They hold a paved surface in place and stop the edge creeping outward.",
    unitLabel: "per piece",
    status: "ready_to_ship",
    quoteOnly: false,
    specs: [
      { label: "Length", value: "900 mm" }, // PLACEHOLDER DIMENSION
      { label: "Section", value: "300 x 150 mm, chamfered" }, // PLACEHOLDER DIMENSION
      { label: "Weight", value: "approx. 65 kg" }, // PLACEHOLDER SPEC
      { label: "Lead time", value: "3 - 5 days if cast to order" }, // PLACEHOLDER LEAD TIME
    ],
    // One photograph only. ProductGallery renders a still and no controls
    // rather than a slider with nothing to slide to.
    images: ["/images/products/product-roadkerb-01.jpg"],
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function getProductsByCategory(categoryId: ProductCategoryId): Product[] {
  return products.filter((product) => product.categoryId === categoryId);
}

export function getCategory(id: ProductCategoryId): ProductCategory | undefined {
  return productCategories.find((category) => category.id === id);
}
