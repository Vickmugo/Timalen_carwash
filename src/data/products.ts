/**
 * CONCRETE PRODUCTS
 *
 * TODO / CONFIRM WITH CLIENT: ALL PRICING, DIMENSIONS AND COPY BELOW ARE
 * PLACEHOLDERS. Two to three example items per category, enough to make the
 * browse -> detail -> cart -> checkout flow real.
 *
 * `status` is set BY HAND. There is no stock count anywhere in this app and
 * there should not be one — this business does not keep reliable counts.
 *   "ready_to_ship"  = normally sitting in the yard, can be collected
 *   "made_to_order"  = cast on demand, has a lead time
 *
 * `image` is null until a real photo exists. To add one:
 *   1. drop the file in /public/images/products/
 *   2. set `image` to "/images/products/<filename>"
 * No component changes needed.
 */

import type { Product, ProductCategory, ProductCategoryId } from "@/types";

export const productCategories: ProductCategory[] = [
  {
    id: "cabros",
    name: "Cabros & Paving",
    blurb:
      "Interlocking paving blocks for driveways, parking yards and walkways.",
  },
  {
    id: "fencing-posts",
    name: "Fencing Posts",
    blurb: "Cast concrete posts for chain-link, barbed wire and panel fencing.",
  },
  {
    id: "decorations",
    name: "Concrete Decorations",
    blurb:
      "Planters, benches and wall panels cast from our own moulds. Custom work welcome.",
  },
];

export const products: Product[] = [
  /* ---------------------------- Cabros ---------------------------- */
  {
    id: "cabro-60",
    slug: "cabro-standard-60mm",
    categoryId: "cabros",
    name: "Standard Cabro 60mm",
    description:
      "General-purpose interlocking paving block for driveways and walkways carrying light vehicle traffic.",
    unitLabel: "per square metre",
    priceKes: 950, // PLACEHOLDER PRICE
    status: "ready_to_ship",
    quoteOnly: false,
    specs: [
      { label: "Thickness", value: "60 mm" },
      { label: "Coverage", value: "approx. 40 pieces per square metre" },
      { label: "Finish", value: "Grey, natural cement" },
      { label: "Typical use", value: "Driveways, walkways, light parking" },
    ],
    image: null, // TODO: /images/products/cabro-standard-60mm.jpg
  },
  {
    id: "cabro-80",
    slug: "cabro-heavy-duty-80mm",
    categoryId: "cabros",
    name: "Heavy Duty Cabro 80mm",
    description:
      "Thicker block for yards taking lorries and constant heavy loading.",
    unitLabel: "per square metre",
    priceKes: 1350, // PLACEHOLDER PRICE
    status: "ready_to_ship",
    quoteOnly: false,
    specs: [
      { label: "Thickness", value: "80 mm" },
      { label: "Coverage", value: "approx. 40 pieces per square metre" },
      { label: "Finish", value: "Grey, natural cement" },
      { label: "Typical use", value: "Loading yards, truck access, industrial" },
    ],
    image: null, // TODO: /images/products/cabro-heavy-duty-80mm.jpg
  },
  {
    id: "kerb-stone",
    slug: "kerb-stone",
    categoryId: "cabros",
    name: "Kerb Stone",
    description:
      "Edging kerb to hold a paved area in place and stop blocks creeping outward.",
    unitLabel: "per piece",
    priceKes: 380, // PLACEHOLDER PRICE
    status: "made_to_order",
    quoteOnly: false,
    specs: [
      { label: "Size", value: "500 x 300 x 100 mm" },
      { label: "Lead time", value: "3 - 5 days" }, // TODO: CONFIRM
      { label: "Finish", value: "Grey, natural cement" },
    ],
    image: null, // TODO: /images/products/kerb-stone.jpg
  },

  /* ------------------------ Fencing Posts ------------------------- */
  {
    id: "post-chainlink-8ft",
    slug: "fencing-post-chainlink-8ft",
    categoryId: "fencing-posts",
    name: "Chain-link Post, 8ft",
    description:
      "Reinforced concrete post pre-drilled for chain-link fencing wire.",
    unitLabel: "per piece",
    priceKes: 750, // PLACEHOLDER PRICE
    status: "ready_to_ship",
    quoteOnly: false,
    specs: [
      { label: "Height", value: "8 ft (approx. 2.4 m)" },
      { label: "Section", value: "100 x 100 mm" },
      { label: "Reinforcement", value: "4 bar, tied" },
      { label: "Holes", value: "Pre-drilled, 5 lines" },
    ],
    image: null, // TODO: /images/products/fencing-post-chainlink-8ft.jpg
  },
  {
    id: "post-corner-8ft",
    slug: "fencing-post-corner-8ft",
    categoryId: "fencing-posts",
    name: "Corner / Straining Post, 8ft",
    description:
      "Heavier corner post for taking the tension at fence ends and direction changes.",
    unitLabel: "per piece",
    priceKes: 1100, // PLACEHOLDER PRICE
    status: "made_to_order",
    quoteOnly: false,
    specs: [
      { label: "Height", value: "8 ft (approx. 2.4 m)" },
      { label: "Section", value: "125 x 125 mm" },
      { label: "Reinforcement", value: "4 bar, heavy tie" },
      { label: "Lead time", value: "3 - 5 days" }, // TODO: CONFIRM
    ],
    image: null, // TODO: /images/products/fencing-post-corner-8ft.jpg
  },

  /* ------------------------- Decorations -------------------------- */
  {
    id: "planter-round",
    slug: "round-planter",
    categoryId: "decorations",
    name: "Round Planter",
    description:
      "Cast planter with a smooth rim, suitable for shrubs and small trees. Sold as a single piece.",
    unitLabel: "per piece",
    priceKes: 2800, // PLACEHOLDER PRICE
    status: "ready_to_ship",
    quoteOnly: false,
    specs: [
      { label: "Diameter", value: "450 mm" },
      { label: "Height", value: "400 mm" },
      { label: "Drainage", value: "Base hole included" },
      { label: "Finish", value: "Grey, natural cement" },
    ],
    image: null, // TODO: /images/products/round-planter.jpg
  },
  {
    id: "garden-bench",
    slug: "garden-bench",
    categoryId: "decorations",
    name: "Garden Bench",
    description:
      "Two-leg cast bench with a moulded seat slab. Heavy — delivery is quoted separately.",
    unitLabel: "per piece",
    priceKes: 12500, // PLACEHOLDER PRICE
    status: "made_to_order",
    quoteOnly: false,
    specs: [
      { label: "Length", value: "1500 mm" },
      { label: "Seat height", value: "450 mm" },
      { label: "Weight", value: "approx. 180 kg" },
      { label: "Lead time", value: "7 - 10 days" }, // TODO: CONFIRM
    ],
    image: null, // TODO: /images/products/garden-bench.jpg
  },
  {
    id: "wall-panel-custom",
    slug: "decorative-wall-panel",
    categoryId: "decorations",
    name: "Decorative Wall Panel (custom mould)",
    description:
      "Screen and wall panels cast from our own moulds. Pattern, panel size and quantity are set per job, so this one is always quoted rather than bought off the page.",
    unitLabel: "per square metre",
    priceKes: 0, // quote only - no list price
    status: "made_to_order",
    quoteOnly: true,
    specs: [
      { label: "Patterns", value: "Existing moulds, or a new mould to order" },
      { label: "Panel size", value: "Set per job" },
      { label: "Lead time", value: "Depends on mould availability" },
      { label: "Pricing", value: "Quoted after a site measure" },
    ],
    image: null, // TODO: /images/products/decorative-wall-panel.jpg
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
