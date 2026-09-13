/**
 * PREMISES PHOTOGRAPHY — the home page hero
 *
 * Real photographs of the yard, shown in the order they appear below.
 * To add, remove or reorder a photo: drop the file in
 * /public/images/property/ and edit this array. PropertyCarousel reads the
 * array as it finds it and needs no change.
 *
 * ORDER — the first entry is the hero's LCP image and the one most visitors
 * will see. The two printed banners lead, one per trade, because between
 * them they state the whole offer in the business's own words: the wash
 * banner lists the services, the concrete banner names and pictures the
 * range. The storefront photograph then closes the set with proof the place
 * is real and findable from the road.
 *
 * ---------------------------------------------------------------------
 * FRAMING — READ THIS BEFORE ADDING A PHOTO. THE RULE HAS CHANGED.
 * ---------------------------------------------------------------------
 * These are shown WHOLE, not cropped. PropertyCarousel renders the set
 * with `object-contain`, so every frame is letterboxed to fit inside the
 * hero rather than filled to it.
 *
 * WHY, and it is not a stylistic preference. Two of the three files below
 * are flattened marketing graphics with the type baked into the pixels,
 * hard against the edges — the phone numbers sit in the bottom corner of
 * the wash banner, the product names run along the bottom of the concrete
 * banner, "CULVERTS" and "CABROS" are pushed right out to the margins.
 * Under the `object-cover` this hero used to use, a phone-width crop ate
 * the phone numbers. There is no focal point that saves them: the text is
 * at the edges by design, so any crop at all cuts something a customer
 * needs. Contain is the only fit that keeps the whole graphic legible, and
 * that is worth more than a full-bleed frame.
 *
 * THE COST, stated plainly: the set does not share an aspect ratio, and
 * with contain that shows as bars.
 *
 *   property-banner-carwash.jpg    1600 x 326    4.91:1  very wide
 *   property-banner-concrete.jpg   1600 x 888    1.80:1  wide
 *   property-storefront.jpg         960 x 1280   0.75:1  upright
 *
 * The hero frame is sized as a compromise across that spread (see
 * PropertyCarousel) and the bars are painted in the same slab-800 as the
 * frame, so they read as matting rather than as a broken image. A NEW
 * PHOTO NEAR 16:9 WILL SIT BEST. Anything wider than about 5:1 or taller
 * than about 3:4 widens the spread again and makes every other slide
 * smaller, because the frame has to accommodate the worst case.
 *
 * If a future set is all real photography with no baked-in type, contain
 * stops earning its cost and the fit should go back to cover — that is a
 * one-word change in PropertyCarousel, not a rewrite.
 *
 * SCRIM — the headline and both buttons sit on a gradient over the bottom
 * of these frames. Under contain that gradient often lands on the matting
 * rather than on photograph, which is strictly easier to read than what it
 * was solved for. The stops were set against the brightest photo in the
 * previous set and are left alone: they still clear WCAG here with room to
 * spare, and the one thing that could break them is a new slide that is
 * near-white along its bottom edge. The concrete banner is white-grounded
 * but its bottom band is the dark call-us bar, so it passes. Re-check if
 * that changes.
 *
 * `alt` is what the photo actually shows. It is read aloud by screen
 * readers and it is what a customer sees if the image fails on a weak
 * connection, so it describes the scene rather than naming a file. For the
 * two banners that means transcribing the type as well: the words are the
 * content of those images, and a description that leaves out the phone
 * number leaves out the point.
 *
 * NOT IN THE ROTATION:
 * The eight yard photographs that made up the previous hero — the entrance
 * shot, the wash bays, the painted signage and the roadside signpost — are
 * still in /public/images/property/ but no longer referenced here. They are
 * real and usable if a gallery is ever added; they were removed from the
 * hero because the client supplied these three as the set they want on the
 * front page. property-washbay-04.jpg additionally carries a solid black
 * redaction over a number plate, which reads as a rendering fault at hero
 * size.
 */

export interface PropertyPhoto {
  /** Public path, from /public. */
  src: string;
  /** What is in the shot. Never a placeholder like "photo 1". */
  alt: string;
}

export const propertyPhotos: PropertyPhoto[] = [
  {
    src: "/images/property/property-banner-carwash.jpg",
    alt: "The Timalen Auto/Carwash banner: the name in yellow across a blue ground, photographs of a car being washed, a dashboard being wiped and a bonnet being waxed, and a list headed WE OFFER — engine wash, vacuum cleaning, auto detailing, under wash, body wash, buffing and waxing, carpet cleaning and interior cleaning. The telephone numbers 0721 726 578 and 0727 602 187 run along the bottom left.",
  },
  {
    src: "/images/property/property-banner-concrete.jpg",
    alt: "The Timalen General Supplies banner, headed CONCRETE POSTS & OTHER CONCRETE PRODUCTS ON SALE, with the range pictured and named in a row: air vents, spindles, slab, roadkerbs, channels and wall caps, plus culverts stacked at the top left and red and grey cabros at the bottom left. Underneath, Strong. Durable. Reliable, and CALL US FOR ALL YOUR CONCRETE NEEDS with the numbers 0721 726 578 and 0727 602 187.",
  },
  {
    src: "/images/property/property-storefront.jpg",
    alt: "The premises from the roadside: the printed Timalen Auto/Carwash banner fixed above the iron-sheet canopy, a silver estate car standing on the earth forecourt underneath it, and the hand-lettered wash price board hanging on the wall behind, with a forested hillside beyond.",
  },
];
