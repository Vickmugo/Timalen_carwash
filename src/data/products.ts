/**
 * CONCRETE PRODUCTS
 *
 * Rebuilt around what the yard actually casts. Eight lines, one entry each
 * — these are product lines, not SKUs, which is how the yard itself talks
 * about them ("posts", "spindles"). Each line is both a category (for the
 * filter nav and the breadcrumb) and the single sellable entry underneath
 * it.
 *
 * ---------------------------------------------------------------------
 * SOME PHOTOS ARE REAL. THE DIMENSIONS ARE NOT.
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
 * THE THREE NEWEST LINES CARRY NO `specs` AT ALL, and that is the same
 * rule rather than an exception to it: nobody has given a single dimension
 * for channels, cornices or cabros, so rather than fill the table with
 * five more guesses the table is omitted. An absent specification is
 * honest; an invented one is not. The detail page hides the heading when
 * the list is empty.
 *
 * PRICES ARE NO LONGER IN THIS FILE. They moved to `product_prices` in the
 * database so the yard can correct them from the staff view without a
 * deploy — see supabase/migrations/20260907150000_price_tables.sql and the
 * later migration that set the confirmed figures.
 * ---------------------------------------------------------------------
 *
 * WHAT IS CONFIRMED AND WHAT IS NOT, as of the September price batch.
 *
 * CONFIRMED BY THE CLIENT: the prices for slab, wall caps, channels,
 * cornices and cabros, and the unit for cabros (per square metre, the only
 * line not sold by the piece).
 *
 * CONFIRMED IN THE TIERS STAGE THAT FOLLOWED: fencing posts and spindles,
 * each priced in three heights. They carry `variants` below and have no
 * single price at all; see supabase/migrations/20260913120000_product_variant_prices.sql.
 * The old one-figure placeholder for each (posts 750 at "8 ft", spindles
 * 320) is gone, not kept as a fourth option — 8 ft is not a height the
 * client sells.
 *
 * NOT CONFIRMED, and still a placeholder: the price on road kerbs.
 *
 * STILL NOT LISTED — pending real content.
 * The hand-painted wall at the yard and the printed banner
 * (property-banner-concrete.jpg) also advertise AIR VENTS and CULVERTS.
 * They stay absent: no photograph, no price, nothing to put on a card.
 *
 * CHANNELS, CORNICES AND CABROS ARE NOW LISTED WITHOUT PHOTOGRAPHS, which
 * reverses what this file used to say, so it is worth writing down why
 * rather than leaving the contradiction. The old argument was that a card
 * with an empty image frame sitting in a grid beside real photography
 * reads as a broken catalogue rather than an honest one. That still holds
 * as a general matter. What changed is that these three now have CONFIRMED
 * PRICES from the client, which the four unlisted lines never did — and a
 * priced line that the yard genuinely sells is worth more to a customer
 * visible with a placeholder than invisible altogether. Air vents and
 * culverts have no price either, so nothing has moved for them.
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
    "A fan of ridged concrete posts laid flat across the gravel yard, with stacks of road kerbs, slabs on edge and wall caps lined up along the boundary wall behind them.",
  "/images/products/product-fencepost-02.jpg":
    "Seven square-section posts laid out parallel on the ground to cure, tie wire offcuts to one side and the steel casting moulds still lying alongside them.",
  "/images/products/product-fencepost-03.jpg":
    "A row of posts laid side by side with grass growing up between them, the line of pre-drilled fencing-wire holes running down the face of each one.",

  /*
    The slab photographs were REPLACED in the September batch. The three
    files under these names are new: the previous pair turned out to be a
    duplicate of a set the client later labelled as wall caps.

    NO TEXTURE IS DESCRIBED IN ANY OF THE THREE, and that is deliberate
    rather than an omission. All three photographs are dominated by a
    strong pattern of parallel lines, and it is tempting to read that as
    ribbing cast into the face. It is not: it is the EDGES of dozens of
    thin flat slabs stacked side by side, seen end-on. Wherever a single
    slab is actually turned face-out — the two leaning in the foreground of
    -02, the one at the front of -01 — the face is plain.

    So the lines belong to the stack, not to the product, and the alt text
    says "stacked edges" rather than naming a surface finish nobody has
    confirmed. If the client ever confirms a textured variant, that is a
    new photograph and a new line here, not a re-reading of these.
  */
  "/images/products/product-slab-01.jpg":
    "Flat slabs stacked in blocks on the gravel, most of them packed edge to edge so the stacks read as rows of close-set lines, with one slab at the front turned to show its plain face and a cut tree stump on the grass beyond.",
  "/images/products/product-slab-02.jpg":
    "Slabs stacked beside an iron-sheet fence, two of them leaning face-out in the foreground showing the plain cast surface, with a clump of tall grass and cut firewood on the ground behind.",
  "/images/products/product-slab-03.jpg":
    "Looking down onto tight rows of slabs stacked on edge, their close-packed edges filling the frame, with weeds coming up in the gaps between the stacks.",

  "/images/products/product-spindle-01.jpg":
    "Rows of turned balusters stacked several courses high on the grass, each with a square cap and a steel fixing pin standing out of the top, while a worker sets out more of them on the gravel behind.",
  "/images/products/product-spindle-02.jpg":
    "Balusters standing in tight blocks on the grass and gravel, seen from above so the square caps and their centre fixing pins fill most of the frame.",
  "/images/products/product-spindle-03.jpg":
    "A close row of balusters standing upright on the grass, the bellied profile of each one clearly visible, with a motorbike and the yard's iron-sheet fence behind.",

  /*
    RENAMED, NOT RESHOT. These are the same two photographs that were filed
    under product-columncap-*.jpg: the client's printed banner names this
    line "WALL CAPS" and pictures exactly this pyramid-topped cap, so only
    the name was ever wrong.
  */
  "/images/products/product-wallcaps-01.jpg":
    "Square wall caps stacked against a wall, each with a shallow pyramid top, the four cast ridges running to the corners and a centre hole for a light or finial.",
  "/images/products/product-wallcaps-02.jpg":
    "Wall caps stacked on edge in a long row beside a whitewashed wall, with two finished caps laid flat in the foreground showing the pyramid face and the centre hole.",

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
    id: "wall-caps",
    name: "Wall Caps",
    blurb:
      "Pyramid-topped caps that finish a gate pillar or wall head and throw the rain off it.",
  },
  {
    id: "road-kerbs",
    name: "Road Kerbs",
    blurb: "Heavy edging kerbs for roadsides, driveways and parking bays.",
  },
  {
    id: "channels",
    name: "Channels",
    blurb: "Cast channel sections for carrying surface water off a yard.",
  },
  {
    id: "cornices",
    name: "Cornices",
    blurb: "Precast cornice moulding for finishing a wall head or roofline.",
  },
  {
    id: "cabros",
    name: "Cabros",
    blurb:
      "Interlocking paving blocks for driveways, parking bays and walkways.",
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
    /*
      THREE HEIGHTS, priced 7 ft 1400, 9 ft 1700, 10 ft 1900 in
      `product_prices`. The client's memo lists them tallest first; the
      picker shows them shortest first so posts and spindles read the same
      way round.
    */
    variants: [
      { id: "7ft", label: "7 ft" },
      { id: "9ft", label: "9 ft" },
      { id: "10ft", label: "10 ft" },
    ],
    status: "ready_to_ship",
    quoteOnly: false,
    /*
      NO "Height" ROW ANY MORE. It said 8 ft, which is not one of the three
      heights the client sells, and the height is now the customer's choice
      on the picker rather than a fact about the product.

      ASSUMPTION, NOT CONFIRMED BY THE CLIENT: Section, Reinforcement and
      Holes are the same at 7, 9 and 10 ft. The client gave a price per
      height and nothing else about them, so one table is shown for all
      three. A taller post plausibly takes another line of holes; if the
      client says so, these become per-variant specs rather than a guess
      stretched across three sizes. The values themselves are still
      placeholders on top of that, as marked.
    */
    specs: [
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
    /*
      NEW PHOTOGRAPHS, September batch. The pair that used to sit here
      (the old product-slab-02/03.jpg) were byte-identical to a set the
      client separately supplied as wall caps, so they were showing the
      wrong product entirely. These three are the slabs themselves. See the
      note above productPhotoAlt about why none of the three descriptions
      mentions a surface texture.
    */
    images: [
      "/images/products/product-slab-01.jpg",
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
    /*
      THREE HEIGHTS, priced 12 in 200, 18 in 250, 24 in 300. The label
      carries the feet as well because the client's memo does, and because
      a customer measuring a balcony in feet should not have to divide.
    */
    variants: [
      { id: "12in", label: "12 in (1 ft)" },
      { id: "18in", label: "18 in (1.5 ft)" },
      { id: "24in", label: "24 in (2 ft)" },
    ],
    status: "ready_to_ship",
    quoteOnly: false,
    /*
      NOT THE SAME TABLE AS FENCING POSTS, and it was checked rather than
      assumed: spindles never had Section / Reinforcement / Holes. Their
      rows are Cap, Fixing and Lead time.

      The "Height: 500 mm" row is removed. 500 mm matches none of the three
      heights the client sells (305, 457, 610 mm), and the height is the
      picker's job now.

      ASSUMPTION, NOT CONFIRMED BY THE CLIENT: the remaining rows hold for
      all three heights. A 24 in spindle may well take a larger cap than a
      12 in one; nobody has said. Same deal as the note on fencing posts.
    */
    specs: [
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

  /* --------------------------- Wall Caps ---------------------------- */
  /*
    WAS "Column & Pillar Caps", id "column-cap", slug "column-caps", with
    its photographs filed under product-columncap-*.jpg. Renamed throughout
    in the September batch to the name the business itself prints on its
    banner. The photographs did not change and did not need to: the banner
    pictures this exact pyramid-topped cap under the words WALL CAPS.
  */
  {
    id: "wall-cap",
    slug: "wall-caps",
    categoryId: "wall-caps",
    name: "Wall Caps",
    description:
      "Square caps with a shallow pyramid top, cast with a centre hole for a light or a finial. They finish a gate pillar or a wall head and shed rain off it.",
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
      "/images/products/product-wallcaps-01.jpg",
      "/images/products/product-wallcaps-02.jpg",
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

  /* ---------------------------- Channels ---------------------------- */
  /*
    NO PHOTOGRAPH YET, and the empty array is doing real work: ProductGallery
    renders its labelled placeholder block at the same ratio a photo would
    occupy, so the card keeps its shape and nothing shifts when the file
    arrives.

    THREE CANDIDATE PHOTOS HAVE ALREADY BEEN REJECTED for this line — two
    the client labelled "channels" that could not be told apart from the
    wall caps set, and the pair that used to sit on the slab entry. The
    banner shows channels as a U-profile trough section and none of the
    three showed that, so none of them are here. Do not fill this array
    until a photograph actually shows the U-profile.

    `specs` is empty for the same reason it is empty on cornices and
    cabros: not one dimension has been given. See the header.
  */
  {
    id: "channel",
    slug: "channels",
    categoryId: "channels",
    name: "Channels",
    description:
      "Cast concrete channel sections, laid end to end to carry surface water along a driveway or a yard edge. Photograph and sizes to follow.",
    unitLabel: "per piece",
    // UNCONFIRMED STATUS. Nobody has said whether these are held in the
    // yard or cast on demand; "ready_to_ship" matches every other line and
    // asserts no lead time, which is the smaller of the two claims.
    status: "ready_to_ship",
    quoteOnly: false,
    specs: [],
    images: [],
  },

  /* ---------------------------- Cornices ---------------------------- */
  {
    id: "cornice",
    slug: "cornices",
    categoryId: "cornices",
    name: "Cornices",
    description:
      "Precast cornice moulding for finishing a wall head or a roofline. Photograph and sizes to follow.",
    unitLabel: "per piece",
    // UNCONFIRMED STATUS — see the note on channels above.
    status: "ready_to_ship",
    quoteOnly: false,
    specs: [],
    images: [],
  },

  /* ----------------------------- Cabros ----------------------------- */
  /*
    THE ONLY LINE IN THIS FILE NOT SOLD BY THE PIECE. `unitLabel` is what a
    customer actually reads next to the figure — on the card, on the detail
    page, in the cart, on the receipt and in a quote — so setting it here is
    the whole of what "show it as per square metre" needs. There is no unit
    column in `product_prices`; the price table holds a number and this file
    says what the number is per.
  */
  {
    id: "cabro",
    slug: "cabros",
    categoryId: "cabros",
    name: "Cabros",
    description:
      "Interlocking paving blocks for driveways, parking bays and walkways, sold by the square metre. Photograph and sizes to follow.",
    unitLabel: "per square metre",
    // UNCONFIRMED STATUS — see the note on channels above.
    status: "ready_to_ship",
    quoteOnly: false,
    specs: [],
    images: [],
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function getProductById(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

export function getProductsByCategory(categoryId: ProductCategoryId): Product[] {
  return products.filter((product) => product.categoryId === categoryId);
}

export function getCategory(id: ProductCategoryId): ProductCategory | undefined {
  return productCategories.find((category) => category.id === id);
}
